import json
from pathlib import Path

from django.db import migrations
from django.utils.text import slugify


def _make_slug(nombre, codigo):
    return slugify(nombre) or slugify(codigo)


def populate(apps, schema_editor):
    Examen = apps.get_model('examenes', 'Examen')
    data_file = Path(__file__).resolve().parent.parent / 'fixtures' / 'examenes_initial.json'
    data = json.loads(data_file.read_text(encoding='utf-8'))

    used_slugs = set()
    for entry in data:
        base_slug = _make_slug(entry['nombre'], entry['codigo'])
        slug = base_slug
        suffix = 1
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        used_slugs.add(slug)

        Examen.objects.create(
            codigo=entry['codigo'],
            nombre=entry['nombre'],
            slug=slug,
            precio=entry.get('precio', 0),
            categoria=entry.get('categoria', 'Otras'),
            descripcion=entry.get('descripcion', ''),
            sintomas=entry.get('sintomas', []),
            requiere_ayuno=False,
            preparacion='',
            activo=True,
        )


def depopulate(apps, schema_editor):
    Examen = apps.get_model('examenes', 'Examen')
    Examen.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('examenes', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(populate, depopulate),
    ]
