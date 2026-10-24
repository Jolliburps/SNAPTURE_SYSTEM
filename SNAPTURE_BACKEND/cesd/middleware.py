import json
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.db.models import Q
from accounts.models import ApiToken
from core.auth import user_from_request


class ActiveAccountMiddleware:
    """Also close the legacy bearer-token path when an account is disabled."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # The legacy mobile reset endpoint exposes debug tokens. CESD accounts
        # must always use the stricter password setup flow, including in dev.
        if request.path in {'/api/auth/password-reset/request/', '/api/auth/password-reset/confirm/', '/api/auth/login/', '/api/auth/register/'} and request.method == 'POST':
            try:
                data = json.loads(request.body)
                email = data.get('email', '') if isinstance(data, dict) else ''
                if isinstance(email, str) and User.objects.filter(Q(email__iexact=email.strip()) | Q(username__iexact=email.strip()), cesd_access__isnull=False).exists():
                    if request.path.endswith('/register/'):
                        return JsonResponse({'detail': 'This email is already in use.'}, status=409)
                    if request.path.endswith('/request/'):
                        return JsonResponse({'requested': True, 'detail': 'Use the CESD password assistance page.'})
                    return JsonResponse({'detail': 'Use the CESD panel for this staff account.'}, status=403)
            except (ValueError, UnicodeDecodeError):
                pass
        if request.path.startswith('/api/') and request.headers.get('Authorization', '').startswith('Bearer '):
            user = user_from_request(request)
            if user is not None and not user.is_active:
                ApiToken.objects.filter(user=user).delete()
                return JsonResponse({'detail': 'This account is deactivated.'}, status=401)
            if user is not None and hasattr(user, 'cesd_access'):
                return JsonResponse({'detail': 'CESD accounts must use the staff panel session.'}, status=403)
        response = self.get_response(request)
        if request.path.startswith(('/api/cesd/', '/api/learning/', '/api/collection/', '/api/announcements/')):
            response['Cache-Control'] = 'no-store'
        return response
