import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveCitySlug } from '../../lib/catalogue-store.js';
import { ensureSlots } from '../../lib/slot-gen.js';
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
  city: z.string().default('bangalore'),
});

/** Specialty keyword lists (from the catalogue) catch symptoms the hand-written rules don't cover. */
function keywordScores(text: string, catalogue: { slug: string; keywords?: string | null }[]) {
  const scores = new Map<string, number>();
  for (const s of catalogue) {
    if (!s.keywords) continue;
    try {
      const hits = text.match(new RegExp(`\\b(${s.keywords})`, 'gi'));
      if (hits?.length) scores.set(s.slug, hits.length);
    } catch {
      // A malformed keyword list shouldn't break triage.
    }
  }
  return scores;
}

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
    const catalogue = await SpecialtyModel.find({}, { slug: 1, keywords: 1 }).lean();
    // Rules are precise, so they outweigh the broader keyword lists.
    for (const [slug, n] of keywordScores(text, catalogue)) scores.set(slug, (scores.get(slug) ?? 0) * 2 + n);
    const isChild = input.forWhom === 'child' || (input.age !== undefined && input.age < 14);
    // Children with everyday illness go to a paediatrician; a specialist problem (eyes, teeth…) stays with the specialist.
    const leader = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
    if (isChild && (!leader || ['general-physician', 'dermatologist', 'ent-specialist', 'gastroenterologist', 'pulmonologist', 'allergist-immunologist', 'infectious-disease-physician'].includes(leader[0]))) {
      scores.set('pediatrician', (leader?.[1] ?? 0) + 1);
    }

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
        // Doctors in the patient's city who consult by video, best-rated and focus-matched first.
        const city = resolveCitySlug(input.city) ?? 'bangalore';
        const base = { specialty: specialtySlug, 'schedule.video': { $ne: 'none' } };
        let candidates = await DoctorModel.find({ ...base, city }).sort({ rating: -1, reviewCount: -1 }).limit(12).lean();
        if (!candidates.length) candidates = await DoctorModel.find(base).sort({ rating: -1, reviewCount: -1 }).limit(12).lean();
        if (focusSlug) candidates.sort((a, b) => Number((b.focusAreas ?? []).includes(focusSlug)) - Number((a.focusAreas ?? []).includes(focusSlug)));
        await ensureSlots(candidates as never);
        const next = await SlotModel.aggregate<{ _id: string; startsAt: Date }>([
          { $match: { doctorSlug: { $in: candidates.map((c) => c.slug) }, mode: 'video', startsAt: { $gte: new Date(), $lte: new Date(Date.now() + 3 * 86_400_000) }, ...bookableSlot() } },
          { $group: { _id: '$doctorSlug', startsAt: { $min: '$startsAt' } } },
        ]);
        const nextBySlug = new Map(next.map((n) => [n._id, n.startsAt]));
        return candidates.filter((c) => nextBySlug.has(c.slug)).slice(0, 3).map((c) => ({ ...c, nextSlotAt: nextBySlug.get(c.slug) }));
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
      doctors: doctors.map(({ schedule: _s, slotsThrough: _t, ...d }) => toDto(d)),
    };
  });
}
