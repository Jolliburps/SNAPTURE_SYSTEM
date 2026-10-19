from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('predictions','0003_predictionrecord_assessment_and_more'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.AddField(model_name='predictionrecord',name='image_quality',field=models.JSONField(default=dict,blank=True)),
        migrations.CreateModel(name='ScanScene',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('request_id',models.CharField(max_length=80)),('image',models.ImageField(upload_to='scenes/%Y/%m/%d/')),
            ('width',models.PositiveIntegerField()),('height',models.PositiveIntegerField()),
            ('frame',models.JSONField(default=list)),('quality',models.JSONField(default=dict)),
            ('status',models.CharField(default='processing',max_length=20)),('error',models.TextField(blank=True)),
            ('truncated',models.BooleanField(default=False)),('created_at',models.DateTimeField(auto_now_add=True)),
            ('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='scan_scenes',to=settings.AUTH_USER_MODEL)),
        ],options={'ordering':['-created_at']}),
        migrations.AddConstraint(model_name='scanscene',constraint=models.UniqueConstraint(fields=('user','request_id'),name='unique_scene_request')),
        migrations.CreateModel(name='SceneItem',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('box',models.JSONField()),('name',models.CharField(max_length=120)),('score',models.FloatField()),
            ('prediction',models.OneToOneField(null=True,on_delete=django.db.models.deletion.SET_NULL,related_name='scene_item',to='predictions.predictionrecord')),
            ('scene',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='items',to='predictions.scanscene')),
        ]),
    ]
