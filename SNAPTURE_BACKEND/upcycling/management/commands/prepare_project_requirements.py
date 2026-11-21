"""Create unpublished editable records from actual catalog text, not invented measurements."""
from django.core.management.base import BaseCommand
from core.recommendations import CATALOG
from upcycling.models import ProjectRequirement

class Command(BaseCommand):
    help='Prepare draft requirements using catalog materials and steps. Existing records are never overwritten.'
    def handle(self,*args,**options):
        count=0
        for material,ideas in CATALOG.items():
            for idea in ideas:
                _,created=ProjectRequirement.objects.get_or_create(recommendation_id=idea['id'],defaults={
                    'material':material,'published':False,
                    'source':f"SNAPTURE built-in catalog: {idea['title']}. Physical requirements and safety checks still require source review.",
                    'specification':{'additional_materials':idea.get('materials',[]),'checkpoint_criteria':idea['steps'],
                                     'final_criteria':[f"Visible outcome of catalog instruction: {step}" for step in idea['steps']]}})
                count+=created
        self.stdout.write(f'Created {count} draft project requirement records. Add sourced dimensions, quantity, conditions and safety requirements before publication.')
