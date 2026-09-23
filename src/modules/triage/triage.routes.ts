import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bookableSlot } from '../../lib/slots.js';
import { toDto } from '../../lib/http.js';
import { DoctorModel } from '../../models/doctor.model.js';
import { SlotModel } from '../../models/slot.model.js';
import { SpecialtyModel } from '../../models/specialty.model.js';
import { ADVICE, RED_FLAGS, RULES } from './triage.rules.js';

const triageBody = z.object({
  symptoms: z.string().trim().min(3, 'Describe your symptoms in a few words').max(1000),
  age: z.coerce.number().int().min(0).max(120).optional(),
  durationDays: z.coerce.number().int().min(0).max(3650).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).default('moderate'),
  forWhom: z.enum(['self', 'child', 'parent', 'other']).default('self'),
});

export async function triageRoutes(app: FastifyInstance) {
  app.post('/triage', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request) => {
    const input = triageBody.parse(request.body);
    const text = input.symptoms;

    const redFlags = RED_FLAGS.filter((f) => f.match.test(text)).map((f) => f.reason);
    if (redFlags.length) {
      return {
        urgency: 'emergency' as const,
        redFlags,
        headline: 'This may be a medical emergency',
        advice: ['Call 108 (free national ambulance) now, or go to the nearest emergency department.', 'Do not drive yourself. Stay with someone if you can.'],
        specialty: null,
        focus: null,
        matched: [],
        doctors: [],
      };
    }

    // Score specialties by matched keywords; children route to paediatrics first.
    const hits = RULES.filter((r) => r.words.test(text));
    const scores = new Map<string, number>();
    for (const hit of hits) scores.set(hit.specialty, (scores.get(hit.specialty) ?? 0) + 1);
    const isChild = input.forWhom === 'child' || (input.age !== undefined && input.age < 14);
    if (isChild) scores.set('pediatrician', (scores.get('pediatrician') ?? 0) + 3);

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const specialtySlug = ranked[0]?.[0] ?? 'general-physician';
    const focusSlug = hits.find((h) => h.specialty === specialtySlug)?.focus ?? null;

    let urgency: 'urgent' | 'soon' | 'routine' = 'routine';
    const reasons: string[] = [];
    if (input.severity === 'severe') { urgency = 'urgent'; reasons.push('You described the symptoms as severe'); }
    if ((input.durationDays ?? 0) >= 7 && urgency === 'routine') { urgency = 'soon'; reasons.push('Symptoms have lasted a week or more'); }
    if (/\bfever\b/i.test(text) && ((input.age ?? 30) >= 60 || isChild) && urgency === 'routine') { urgency = 'soon'; reasons.push('Fever in young children and older adults should be seen promptly'); }
    if (/\b(high fever|104|103)\b/i.test(text)) { urgency = 'urgent'; reasons.push('A high fever needs a same-day review'); }

    const [specialty, doctors] = await Promise.all([
      SpecialtyModel.findOne({ slug: specialtySlug }).lean(),
      (async () => {
        const available = await SlotModel.distinct('doctorSlug', { mode: 'video', startsAt: { $gte: new Date(), $lte: new Date(Date.now() + 2 * 86_400_000) }, ...bookableSlot() });
        const filter: Record<string, unknown> = { specialty: specialtySlug, slug: { $in: available } };
        const withFocus = focusSlug ? await DoctorModel.find({ ...filter, focusAreas: focusSlug }).sort({ rating: -1 }).limit(3).lean() : [];
        return withFocus.length ? withFocus : DoctorModel.find(filter).sort({ rating: -1 }).limit(3).lean();
      })(),
    ]);
    const focus = specialty?.subSpecialties.find((s) => s.slug === focusSlug) ?? null;

    return {
      urgency,
      redFlags: [],
      headline: urgency === 'urgent' ? `See a ${specialty?.name ?? 'doctor'} today` : urgency === 'soon' ? `Book a ${specialty?.name ?? 'doctor'} within 24–48 hours` : `A ${specialty?.name ?? 'doctor'} can help`,
      reasons,
      advice: ADVICE[specialtySlug] ?? ADVICE['general-physician']!,
      specialty: specialty ? { slug: specialty.slug, name: specialty.name, plural: specialty.plural, icon: specialty.icon, fromPrice: specialty.fromPrice } : null,
      focus: focus ? { slug: focus.slug, name: focus.name, description: focus.description } : null,
      matched: [...new Set(hits.map((h) => text.match(h.words)?.[0]).filter(Boolean))] as string[],
      doctors: doctors.map((d) => toDto(d)),
    };
  });
}
