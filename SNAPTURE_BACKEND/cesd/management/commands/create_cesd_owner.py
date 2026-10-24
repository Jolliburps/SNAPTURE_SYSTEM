from getpass import getpass
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction
from accounts.models import Profile
from cesd.models import StaffAccess


class Command(BaseCommand):
    help = 'Create the sole CESD owner interactively. No default/shared password.'

    def handle(self, *args, **options):
        if StaffAccess.objects.filter(access='owner').exists():
            raise CommandError('An owner already exists.')
        email = input('Owner email: ').strip().lower()
        name = input('Full name: ').strip()
        password = getpass('Password: ')
        if password != getpass('Confirm password: '):
            raise CommandError('Passwords do not match.')
        user = get_user_model()(username=email, email=email, is_staff=True)
        try:
            validate_email(email)
            validate_password(password, user)
            if not name or len(name) > 120:
                raise ValidationError('Name must be 1–120 characters.')
            user.full_clean(exclude=['password'])
        except ValidationError as error:
            raise CommandError('; '.join(error.messages)) from error
        with transaction.atomic():
            user.set_password(password)
            user.save()
            Profile.objects.create(user=user, display_name=name, role='admin')
            StaffAccess.objects.create(user=user, access='owner')
        self.stdout.write(self.style.SUCCESS('CESD owner created. Sign in with this individual account.'))
