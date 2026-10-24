from pathlib import Path
from PIL import Image, UnidentifiedImageError
from django import forms
from .models import Announcement, Material, Policy, Schedule

# Copied verbatim from the mobile app's supplied 47-name barangay list.
BARANGAYS = ['Aniban 1', 'Aniban 2', 'Bayanan', 'Dulong Bayan', 'Habay 1', 'Habay 2',
    'Kaingin Digman', 'Ligas 1', 'Ligas 2', 'Mabolo', 'Maliksi 1', 'Maliksi 2',
    'Mambog 1', 'Mambog 2', 'Mambog 3', 'Mambog 4', 'Niog', 'Poblacion', 'Real',
    'Salinas 1', 'Salinas 2', 'Sinbanali', 'Talaba 1', 'Molino 1', 'Molino 2',
    'Molino 3', 'Molino 4', 'Molino 5', 'Molino 6', 'Molino 7', 'P.F. Espiritu 1',
    'P.F. Espiritu 2', 'P.F. Espiritu 3', 'P.F. Espiritu 4', 'P.F. Espiritu 5',
    'P.F. Espiritu 6', 'Queens Row Central', 'Queens Row East', 'Queens Row West',
    'San Nicolas 1', 'San Nicolas 2', 'San Nicolas 3', 'Talaba 2', 'Talaba 3',
    'Zapote 1', 'Zapote 2', 'Zapote 3']


def validate_upload(file, kind):
    limits = {'PDF Guide': 20, 'Infographic': 10, 'Video': 100}
    limit = limits[kind] * 1024 * 1024
    if file.size == 0 or file.size > limit:
        raise forms.ValidationError(f'File must be nonempty and no larger than {limits[kind]} MB.')
    ext = Path(file.name).suffix.lower()
    header = file.read(32)
    file.seek(0)
    if kind == 'PDF Guide':
        valid = ext == '.pdf' and header.startswith(b'%PDF-')
    elif kind == 'Video':
        valid = (ext == '.mp4' and header[4:8] == b'ftyp') or (ext == '.webm' and header.startswith(b'\x1a\x45\xdf\xa3'))
    else:
        valid = ext in {'.png', '.jpg', '.jpeg', '.webp'}
        if valid:
            try:
                image = Image.open(file)
                image.verify()
                valid = image.format in {'PNG', 'JPEG', 'WEBP'}
            except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError):
                valid = False
            finally:
                file.seek(0)
    if not valid:
        raise forms.ValidationError('File content does not match an allowed PDF, image, or video format for this material type.')
    return file


class PolicyForm(forms.ModelForm):
    class Meta:
        model = Policy
        fields = ['title', 'category', 'effective_date', 'description', 'content', 'status', 'attachment']

    def clean_attachment(self):
        file = self.cleaned_data.get('attachment')
        return validate_upload(file, 'PDF Guide') if file and 'attachment' in self.files else file


class AnnouncementForm(forms.ModelForm):
    class Meta:
        model = Announcement
        fields = ['title', 'category', 'description', 'status']


class MaterialForm(forms.ModelForm):
    class Meta:
        model = Material
        fields = ['title', 'category', 'description', 'material_type', 'status', 'attachment']

    def clean(self):
        data = super().clean()
        file, kind = data.get('attachment'), data.get('material_type')
        if file and kind:
            if 'attachment' in self.files:
                validate_upload(file, kind)
            elif self.instance.pk:
                original = Material.objects.get(pk=self.instance.pk)
                if original.material_type != kind:
                    self.add_error('attachment', 'Upload a replacement file when changing the material type.')
        return data


class ScheduleForm(forms.ModelForm):
    barangay = forms.ChoiceField(choices=[(x, x) for x in BARANGAYS])

    class Meta:
        model = Schedule
        fields = ['waste_type', 'barangay', 'collection_date', 'start_time', 'end_time', 'notes', 'status']

    def clean(self):
        data = super().clean()
        if data.get('start_time') and data.get('end_time') and data['start_time'] >= data['end_time']:
            self.add_error('end_time', 'End time must be later than start time on the same date.')
        return data
