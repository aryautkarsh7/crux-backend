import { cities, localityByPin } from './catalogue-store.js';

/** Rough centroids for Bengaluru pincodes, used to find the nearest lab and check home-collection reach. */
const PINCODES: Record<string, { area: string; lat: number; lng: number }> = {
  '560001': { area: 'MG Road', lat: 12.9757, lng: 77.6011 },
  '560002': { area: 'Chickpet', lat: 12.965, lng: 77.577 },
  '560003': { area: 'Malleswaram', lat: 13.0035, lng: 77.5709 },
  '560004': { area: 'Basavanagudi', lat: 12.9422, lng: 77.5738 },
  '560005': { area: 'Frazer Town', lat: 12.9975, lng: 77.614 },
  '560008': { area: 'HAL 2nd Stage', lat: 12.9719, lng: 77.6512 },
  '560010': { area: 'Rajajinagar', lat: 12.9916, lng: 77.554 },
  '560011': { area: 'Jayanagar', lat: 12.9299, lng: 77.5838 },
  '560016': { area: 'Ramamurthy Nagar', lat: 13.012, lng: 77.677 },
  '560017': { area: 'HAL Airport Road', lat: 12.9591, lng: 77.6974 },
  '560020': { area: 'Seshadripuram', lat: 12.99, lng: 77.575 },
  '560022': { area: 'Yeshwanthpur', lat: 13.028, lng: 77.54 },
  '560024': { area: 'Hebbal', lat: 13.0358, lng: 77.597 },
  '560025': { area: 'Richmond Town', lat: 12.958, lng: 77.6 },
  '560027': { area: 'Wilson Garden', lat: 12.95, lng: 77.597 },
  '560029': { area: 'BTM Layout', lat: 12.93, lng: 77.61 },
  '560030': { area: 'Adugodi', lat: 12.943, lng: 77.61 },
  '560032': { area: 'RT Nagar', lat: 13.022, lng: 77.595 },
  '560034': { area: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  '560036': { area: 'KR Puram', lat: 13.007, lng: 77.696 },
  '560037': { area: 'Marathahalli', lat: 12.9569, lng: 77.7011 },
  '560038': { area: 'Indiranagar', lat: 12.9719, lng: 77.6412 },
  '560040': { area: 'Vijayanagar', lat: 12.9716, lng: 77.533 },
  '560041': { area: 'Jayanagar East', lat: 12.925, lng: 77.5938 },
  '560043': { area: 'Kalyan Nagar', lat: 13.024, lng: 77.64 },
  '560047': { area: 'Ejipura', lat: 12.948, lng: 77.623 },
  '560048': { area: 'Mahadevapura', lat: 12.991, lng: 77.696 },
  '560050': { area: 'Banashankari', lat: 12.9255, lng: 77.5468 },
  '560054': { area: 'Mathikere', lat: 13.033, lng: 77.564 },
  '560061': { area: 'Subramanyapura', lat: 12.9, lng: 77.54 },
  '560064': { area: 'Yelahanka', lat: 13.1007, lng: 77.5963 },
  '560066': { area: 'Whitefield', lat: 12.9698, lng: 77.75 },
  '560067': { area: 'Kadugodi', lat: 12.995, lng: 77.76 },
  '560068': { area: 'Bommanahalli', lat: 12.9, lng: 77.63 },
  '560070': { area: 'Banashankari 2nd Stage', lat: 12.925, lng: 77.56 },
  '560071': { area: 'Domlur', lat: 12.961, lng: 77.6387 },
  '560076': { area: 'Bannerghatta Road', lat: 12.89, lng: 77.597 },
  '560078': { area: 'JP Nagar', lat: 12.9063, lng: 77.5857 },
  '560085': { area: 'Banashankari 3rd Stage', lat: 12.915, lng: 77.545 },
  '560086': { area: 'Basaveshwaranagar', lat: 12.993, lng: 77.538 },
  '560087': { area: 'Varthur', lat: 12.94, lng: 77.74 },
  '560092': { area: 'Sahakara Nagar', lat: 13.062, lng: 77.587 },
  '560093': { area: 'CV Raman Nagar', lat: 12.985, lng: 77.663 },
  '560094': { area: 'Sanjaynagar', lat: 13.035, lng: 77.575 },
  '560095': { area: 'Koramangala', lat: 12.94, lng: 77.62 },
  '560097': { area: 'Vidyaranyapura', lat: 13.077, lng: 77.558 },
  '560099': { area: 'Bommasandra', lat: 12.815, lng: 77.695 },
  '560100': { area: 'Electronic City', lat: 12.8452, lng: 77.6602 },
  '560102': { area: 'HSR Layout', lat: 12.9116, lng: 77.6474 },
  '560103': { area: 'Bellandur', lat: 12.926, lng: 77.676 },
};

/** Where distances are measured from when we don't know the patient's pincode. */
export const DEFAULT_PINCODE = '560038';

export type Place = { pincode: string; area: string; lat: number; lng: number; approximate: boolean; city: string };


/**
 * Resolves a pincode in any city we serve to a point. Known locality pincodes are exact; other
 * pincodes in a served city fall back to the city centre. Anything else returns null (not serviceable).
 */
export function locate(pincode: string): Place | null {
  if (!/^\d{6}$/.test(pincode)) return null;
  const legacy = PINCODES[pincode];
  if (legacy) return { pincode, ...legacy, approximate: false, city: 'bangalore' };
  const known = localityByPin(pincode);
  if (known) return { pincode, area: known.area, lat: known.lat, lng: known.lng, approximate: false, city: known.city };
  const city = cities().find((c) => c.pincodePrefixes.some((p) => pincode.startsWith(p)));
  return city ? { pincode, area: city.name, lat: city.lat, lng: city.lng, approximate: true, city: city.slug } : null;
}

/** The default "near you" point for a city: its first listed locality. */
export function cityOrigin(citySlug: string): Place {
  const city = cities().find((c) => c.slug === citySlug) ?? cities()[0]!;
  const l = city.localities[0];
  // A city added in the admin panel may not have localities yet: measure from its centre.
  if (!l) return { pincode: '', area: city.name, lat: city.lat, lng: city.lng, approximate: true, city: city.slug };
  return { pincode: l.pincode, area: l.name, lat: l.lat, lng: l.lng, approximate: false, city: city.slug };
}

/** Great-circle distance in km, rounded to 0.1. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
