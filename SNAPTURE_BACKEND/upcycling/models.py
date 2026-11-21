"""Additive suitability, collection, evidence and community records."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from core.materials import SCOPE_LABELS


def validate_requirements(spec):
    if not isinstance(spec,dict):raise ValidationError('Requirements must be an object.')
    allowed={'dimensions','object_types','shapes','conditions','minimum_quantity','maximum_quantity','tools','additional_materials','goals','safety','visible_characteristics','checkpoint_criteria','final_criteria'}
    if set(spec)-allowed:raise ValidationError('Unknown requirement field.')
    visible=spec.get('visible_characteristics',{})
    if not isinstance(visible,dict) or set(visible)-{'damage','deformation','wet_appearance','visible_contamination','usable_portions','structural_appearance'}:raise ValidationError('Use supported visible characteristics.')
    if any(not isinstance(values,list) or not values or any(not isinstance(v,str) or not v for v in values) for values in visible.values()):raise ValidationError('Visible requirements need lists of allowed observations.')
    for key in ('minimum_quantity','maximum_quantity'):
        if key in spec and (type(spec[key]) is not int or not 1<=spec[key]<=100000):raise ValidationError('Quantity limits must be positive integers.')
    if spec.get('maximum_quantity',100000)<spec.get('minimum_quantity',1):raise ValidationError('Quantity limits conflict.')
    for key in ('object_types','shapes','conditions','tools','additional_materials','goals','safety','checkpoint_criteria','final_criteria'):
        if key in spec and (not isinstance(spec[key],list) or any(not isinstance(v,str) or not v.strip() for v in spec[key])):raise ValidationError(f'{key} must be a list of text values.')
    dimensions=spec.get('dimensions',{})
    if not isinstance(dimensions,dict) or set(dimensions)-{'length','width','height','diameter','thickness','capacity'}:raise ValidationError('Use supported dimensions in millimeters or capacity in milliliters.')
    for limits in dimensions.values():
        if not isinstance(limits,dict) or not limits or set(limits)-{'minimum','maximum'}:raise ValidationError('Dimension limits require minimum or maximum.')
        if any(type(v) not in (float,int) or not 0<v<100000 for v in limits.values()):raise ValidationError('Dimension limits must be finite positive millimeter values.')
        if limits.get('minimum',0)>limits.get('maximum',100000):raise ValidationError('Dimension limits conflict.')


class ProjectRequirement(models.Model):
    recommendation_id=models.CharField(max_length=160,unique=True)
    material=models.CharField(max_length=100,choices=[(s,s) for s in SCOPE_LABELS])
    specification=models.JSONField(default=dict,validators=[validate_requirements])
    source=models.TextField(help_text='Source for project-specific physical and safety requirements.')
    published=models.BooleanField(default=False)
    updated_at=models.DateTimeField(auto_now=True)
    def __str__(self):return self.recommendation_id
    def clean(self):
        validate_requirements(self.specification)
        if self.published and not self.source.strip():raise ValidationError('Published requirements need a source.')


class AdditionalView(models.Model):
    prediction=models.ForeignKey('predictions.PredictionRecord',on_delete=models.CASCADE,related_name='additional_views')
    request_id=models.CharField(max_length=80)
    view=models.CharField(max_length=12,choices=[(s,s.title()) for s in ('front','back','side','left','right','top','bottom','inside')])
    image=models.ImageField(upload_to='upcycling/views/%Y/%m/%d/')
    observations=models.JSONField(default=dict)
    same_item_confirmed=models.BooleanField(default=False)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['prediction','request_id'],name='unique_additional_item_view')]


class InventoryLot(models.Model):
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    prediction=models.OneToOneField('predictions.PredictionRecord',null=True,blank=True,on_delete=models.SET_NULL)
    material=models.CharField(max_length=100,choices=[(s,s) for s in SCOPE_LABELS])
    object_type=models.CharField(max_length=120,blank=True)
    quantity=models.PositiveIntegerField(default=1)
    consumed=models.PositiveIntegerField(default=0)
    attributes=models.JSONField(default=dict)
    confirmed=models.BooleanField(default=True)
    updated_at=models.DateTimeField(auto_now=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=models.Q(quantity__gte=models.F('consumed')),name='inventory_consumption_within_quantity')]


class StepPhoto(models.Model):
    project=models.ForeignKey('predictions.UserProject',on_delete=models.CASCADE,related_name='step_photos')
    step_index=models.PositiveIntegerField()
    image=models.ImageField(upload_to='upcycling/steps/%Y/%m/%d/')
    digest=models.CharField(max_length=64)
    status=models.CharField(max_length=24,default='submitted',choices=[(s,s.replace('_',' ').title()) for s in ('submitted','ai_matches','needs_correction','retake','reviewer_accepted')])
    assessment=models.JSONField(default=dict)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering=['-pk']
        constraints=[models.UniqueConstraint(fields=['project','digest'],name='unique_upcycling_step_photo')]


class FinalProductAssessment(models.Model):
    project=models.ForeignKey('predictions.UserProject',on_delete=models.CASCADE,related_name='final_assessments')
    image=models.ImageField(upload_to='upcycling/final/%Y/%m/%d/')
    digest=models.CharField(max_length=64)
    assessment=models.JSONField(default=dict)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering=['-pk']
        constraints=[models.UniqueConstraint(fields=['project','digest'],name='unique_final_product_photo')]


class CompletedProject(models.Model):
    project=models.OneToOneField('predictions.UserProject',on_delete=models.PROTECT,related_name='completion_record')
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    name=models.CharField(max_length=160)
    image=models.ImageField(upload_to='upcycling/completed/%Y/%m/%d/')
    materials=models.JSONField(default=list)
    description=models.TextField(blank=True)
    feedback=models.TextField(blank=True)
    completed_at=models.DateTimeField()
    recorded_at=models.DateTimeField(auto_now_add=True)
    verification_status=models.CharField(max_length=24,default='photo_documented')
    final_assessment=models.JSONField(default=dict)


class MaterialUsage(models.Model):
    completion=models.ForeignKey(CompletedProject,on_delete=models.CASCADE,related_name='usage')
    lot=models.ForeignKey(InventoryLot,on_delete=models.PROTECT)
    quantity=models.PositiveIntegerField()
    class Meta:
        constraints=[models.UniqueConstraint(fields=['completion','lot'],name='unique_completion_material_usage')]


class Organization(models.Model):
    name=models.CharField(max_length=160)
    description=models.TextField(blank=True)
    active=models.BooleanField(default=True)
    def __str__(self):return self.name


class Membership(models.Model):
    organization=models.ForeignKey(Organization,on_delete=models.CASCADE,related_name='memberships')
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    role=models.CharField(max_length=12,choices=[('manager','Manager'),('reviewer','Reviewer')])
    class Meta:
        constraints=[models.UniqueConstraint(fields=['organization','user'],name='unique_organization_membership')]


class Program(models.Model):
    organization=models.ForeignKey(Organization,on_delete=models.PROTECT)
    title=models.CharField(max_length=160)
    description=models.TextField()
    eligibility=models.TextField(blank=True)
    guidelines=models.TextField()
    accepted_materials=models.JSONField(default=list)
    criteria=models.JSONField(default=list)
    starts_at=models.DateTimeField()
    ends_at=models.DateTimeField()
    awards=models.TextField(blank=True)
    status=models.CharField(max_length=12,default='draft',choices=[(s,s.title()) for s in ('draft','published','closed')])
    def __str__(self):return self.title
    def clean(self):
        if self.starts_at and self.ends_at and self.ends_at<=self.starts_at:raise ValidationError('End must follow start.')
        if not isinstance(self.accepted_materials,list) or any(s not in SCOPE_LABELS for s in self.accepted_materials):raise ValidationError('Choose supported material labels.')
        if not isinstance(self.criteria,list) or not self.criteria or len(self.criteria)>10:raise ValidationError('Publish 1–10 rating criteria.')
        for c in self.criteria:
            if not isinstance(c,dict) or not isinstance(c.get('name'),str) or not c['name'].strip() or type(c.get('maximum')) is not int or not 1<=c['maximum']<=100:raise ValidationError('Each criterion needs a name and integer maximum from 1 to 100.')
        if len({c['name'] for c in self.criteria})!=len(self.criteria):raise ValidationError('Criterion names must be distinct.')


class Submission(models.Model):
    program=models.ForeignKey(Program,on_delete=models.PROTECT,related_name='submissions')
    completion=models.ForeignKey(CompletedProject,on_delete=models.PROTECT)
    snapshot=models.JSONField(default=dict)
    status=models.CharField(max_length=12,default='submitted',choices=[(s,s.title()) for s in ('submitted','rated','rejected')])
    scores=models.JSONField(default=dict,blank=True)
    feedback=models.TextField(blank=True)
    recognition=models.CharField(max_length=160,blank=True)
    reviewer=models.ForeignKey(settings.AUTH_USER_MODEL,null=True,blank=True,on_delete=models.PROTECT)
    reviewed_at=models.DateTimeField(null=True,blank=True)
    submitted_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['program','completion'],name='unique_program_project_submission')]
