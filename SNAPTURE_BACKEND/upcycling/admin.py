"""Use existing Django staff identities; scope program access to organizations."""
from django.contrib import admin
from .models import Organization,Membership,Program,ProjectRequirement,AdditionalView,InventoryLot,StepPhoto,FinalProductAssessment,CompletedProject,MaterialUsage,Submission

@admin.register(ProjectRequirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display=('recommendation_id','material','published','source')
    list_filter=('material','published')
    def save_model(self,request,obj,form,change):
        obj.full_clean()
        super().save_model(request,obj,form,change)

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display=('name','active')

@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display=('user','organization','role')

@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display=('title','organization','status','starts_at','ends_at')
    def get_queryset(self,request):
        qs=super().get_queryset(request)
        return qs if request.user.is_superuser else qs.filter(organization__memberships__user=request.user,organization__memberships__role='manager')
    def formfield_for_foreignkey(self,db_field,request,**kwargs):
        if db_field.name=='organization' and not request.user.is_superuser:
            kwargs['queryset']=Organization.objects.filter(memberships__user=request.user,memberships__role='manager',active=True)
        return super().formfield_for_foreignkey(db_field,request,**kwargs)
    def get_readonly_fields(self,request,obj=None):
        return tuple(f.name for f in self.model._meta.fields if f.name!='id') if obj and obj.submissions.exists() else ()
    def save_model(self,request,obj,form,change):
        obj.full_clean();super().save_model(request,obj,form,change)

class ReadOnly(admin.ModelAdmin):
    def get_readonly_fields(self,request,obj=None):return tuple(f.name for f in self.model._meta.fields)
    def has_add_permission(self,request):return False
    def has_change_permission(self,request,obj=None):return False
    def has_delete_permission(self,request,obj=None):return False

for model in (AdditionalView,InventoryLot,StepPhoto,FinalProductAssessment,CompletedProject,MaterialUsage,Submission):admin.site.register(model,ReadOnly)
