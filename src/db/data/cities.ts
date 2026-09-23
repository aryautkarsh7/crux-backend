/**
 * Cities Curxx serves, with the localities we list providers in. Coordinates and pincodes
 * are approximate locality centres — good enough for "nearest lab" and distance chips.
 * The frontend keeps an identical copy in src/lib/city-data.ts for routing and the city picker.
 */

export type Locality = { slug: string; name: string; pincode: string; lat: number; lng: number };
export type City = {
  slug: string;
  name: string;
  state: string;
  /** State medical council shown on doctor registrations. */
  council: string;
  lat: number;
  lng: number;
  /** First three digits of the city's pincodes, for serviceability checks. */
  pincodePrefixes: string[];
  aliases: string[];
  tier: 1 | 2;
  localities: Locality[];
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const L = (name: string, pincode: string, lat: number, lng: number): Locality => ({ slug: slug(name), name, pincode, lat, lng });

export const CITIES: City[] = [
  {
    slug: 'bangalore', name: 'Bengaluru', state: 'Karnataka', council: 'KMC', lat: 12.9716, lng: 77.5946, pincodePrefixes: ['560', '561', '562'], aliases: ['bengaluru', 'blr'], tier: 1,
    localities: [
      L('Indiranagar', '560038', 12.9719, 77.6412), L('Koramangala', '560034', 12.9352, 77.6245), L('HSR Layout', '560102', 12.9116, 77.6474),
      L('Whitefield', '560066', 12.9698, 77.75), L('Jayanagar', '560011', 12.9299, 77.5838), L('JP Nagar', '560078', 12.9063, 77.5857),
      L('Malleswaram', '560003', 13.0035, 77.5709), L('Hebbal', '560024', 13.0358, 77.597), L('Marathahalli', '560037', 12.9569, 77.7011),
      L('Electronic City', '560100', 12.8452, 77.6602), L('Banashankari', '560050', 12.9255, 77.5468), L('Bellandur', '560103', 12.926, 77.676),
      L('BTM Layout', '560029', 12.93, 77.61), L('Rajajinagar', '560010', 12.9916, 77.554), L('HAL Airport Road', '560017', 12.9591, 77.6974),
      L('Bannerghatta Road', '560076', 12.89, 77.597), L('Vasanth Nagar', '560052', 12.9906, 77.5941), L('MG Road', '560001', 12.9757, 77.6011),
      L('Yelahanka', '560064', 13.1007, 77.5963), L('RT Nagar', '560032', 13.022, 77.595),
    ],
  },
  {
    slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra', council: 'MMC', lat: 19.076, lng: 72.8777, pincodePrefixes: ['400', '401'], aliases: ['bombay'], tier: 1,
    localities: [
      L('Andheri West', '400053', 19.1364, 72.8296), L('Bandra West', '400050', 19.0596, 72.8295), L('Powai', '400076', 19.1176, 72.906),
      L('Dadar', '400014', 19.0178, 72.8478), L('Colaba', '400005', 18.9067, 72.8147), L('Borivali West', '400092', 19.2307, 72.8567),
      L('Chembur', '400071', 19.0522, 72.9005), L('Malad West', '400064', 19.1874, 72.8484), L('Juhu', '400049', 19.1075, 72.8263),
      L('Worli', '400018', 19.0176, 72.8166), L('Goregaon East', '400063', 19.1663, 72.8526), L('Thane West', '400601', 19.2183, 72.9781),
    ],
  },
  {
    slug: 'delhi', name: 'Delhi', state: 'Delhi', council: 'DMC', lat: 28.6139, lng: 77.209, pincodePrefixes: ['110'], aliases: ['new-delhi', 'delhi-ncr'], tier: 1,
    localities: [
      L('Connaught Place', '110001', 28.6315, 77.2167), L('Saket', '110017', 28.5245, 77.2066), L('Dwarka', '110075', 28.5921, 77.046),
      L('Rohini', '110085', 28.7495, 77.0565), L('Lajpat Nagar', '110024', 28.5677, 77.2433), L('Karol Bagh', '110005', 28.6519, 77.1909),
      L('Janakpuri', '110058', 28.6219, 77.0878), L('Vasant Kunj', '110070', 28.52, 77.159), L('Pitampura', '110034', 28.7033, 77.131),
      L('Mayur Vihar', '110091', 28.609, 77.294), L('Greater Kailash', '110048', 28.5484, 77.238), L('Rajouri Garden', '110027', 28.6415, 77.1209),
    ],
  },
  {
    slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana', council: 'TSMC', lat: 17.385, lng: 78.4867, pincodePrefixes: ['500', '501', '502'], aliases: ['secunderabad'], tier: 1,
    localities: [
      L('Banjara Hills', '500034', 17.4156, 78.4347), L('Jubilee Hills', '500033', 17.4326, 78.4071), L('Gachibowli', '500032', 17.4401, 78.3489),
      L('Madhapur', '500081', 17.4483, 78.3915), L('Kukatpally', '500072', 17.4948, 78.3996), L('Secunderabad', '500003', 17.4399, 78.4983),
      L('Ameerpet', '500016', 17.4375, 78.4482), L('Kondapur', '500084', 17.46, 78.3548), L('Begumpet', '500017', 17.4447, 78.4664),
      L('Dilsukhnagar', '500060', 17.3688, 78.5247), L('LB Nagar', '500074', 17.3457, 78.5522), L('Himayatnagar', '500029', 17.4009, 78.486),
    ],
  },
  {
    slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', council: 'TNMC', lat: 13.0827, lng: 80.2707, pincodePrefixes: ['600', '601', '603'], aliases: ['madras'], tier: 1,
    localities: [
      L('T Nagar', '600017', 13.0418, 80.2341), L('Adyar', '600020', 13.0012, 80.2565), L('Anna Nagar', '600040', 13.085, 80.2101),
      L('Velachery', '600042', 12.9815, 80.218), L('Mylapore', '600004', 13.0368, 80.2676), L('Nungambakkam', '600034', 13.0569, 80.2425),
      L('Thoraipakkam', '600097', 12.9416, 80.2361), L('Porur', '600116', 13.0382, 80.1565), L('Tambaram', '600045', 12.9249, 80.1),
      L('Guindy', '600032', 13.0067, 80.2206), L('Kilpauk', '600010', 13.085, 80.242), L('Besant Nagar', '600090', 13.0003, 80.2667),
    ],
  },
  {
    slug: 'pune', name: 'Pune', state: 'Maharashtra', council: 'MMC', lat: 18.5204, lng: 73.8567, pincodePrefixes: ['411', '412'], aliases: ['poona'], tier: 1,
    localities: [
      L('Koregaon Park', '411001', 18.5362, 73.894), L('Kothrud', '411038', 18.5074, 73.8077), L('Hinjewadi', '411057', 18.5913, 73.7389),
      L('Baner', '411045', 18.559, 73.7868), L('Viman Nagar', '411014', 18.5679, 73.9143), L('Hadapsar', '411028', 18.5089, 73.926),
      L('Aundh', '411007', 18.558, 73.8075), L('Wakad', '411057', 18.5987, 73.765), L('Shivajinagar', '411005', 18.5308, 73.8475),
      L('Kharadi', '411014', 18.5515, 73.9348), L('Pimpri', '411018', 18.6298, 73.7997),
    ],
  },
  {
    slug: 'kolkata', name: 'Kolkata', state: 'West Bengal', council: 'WBMC', lat: 22.5726, lng: 88.3639, pincodePrefixes: ['700', '711'], aliases: ['calcutta'], tier: 1,
    localities: [
      L('Salt Lake', '700091', 22.58, 88.415), L('Park Street', '700016', 22.553, 88.352), L('Ballygunge', '700019', 22.527, 88.365),
      L('New Town', '700156', 22.595, 88.484), L('Howrah', '711101', 22.5958, 88.2636), L('Behala', '700034', 22.498, 88.31),
      L('Dum Dum', '700028', 22.62, 88.42), L('Garia', '700084', 22.466, 88.383), L('Alipore', '700027', 22.535, 88.327),
      L('Jadavpur', '700032', 22.499, 88.371), L('Shyambazar', '700004', 22.601, 88.372),
    ],
  },
  {
    slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', council: 'GMC', lat: 23.0225, lng: 72.5714, pincodePrefixes: ['380', '382'], aliases: ['amdavad'], tier: 1,
    localities: [
      L('Navrangpura', '380009', 23.0365, 72.5611), L('Satellite', '380015', 23.03, 72.517), L('Bodakdev', '380054', 23.0396, 72.5074),
      L('Maninagar', '380008', 22.9962, 72.6031), L('Vastrapur', '380015', 23.035, 72.529), L('SG Highway', '380054', 23.06, 72.51),
      L('Paldi', '380007', 23.01, 72.56), L('Chandkheda', '382424', 23.11, 72.585), L('Thaltej', '380059', 23.05, 72.5), L('Naranpura', '380013', 23.06, 72.55),
    ],
  },
  {
    slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan', council: 'RMC', lat: 26.9124, lng: 75.7873, pincodePrefixes: ['302', '303'], aliases: ['pink-city'], tier: 2,
    localities: [
      L('Malviya Nagar', '302017', 26.854, 75.815), L('Vaishali Nagar', '302021', 26.911, 75.743), L('C-Scheme', '302001', 26.911, 75.801),
      L('Mansarovar', '302020', 26.87, 75.76), L('Raja Park', '302004', 26.897, 75.826), L('Jagatpura', '302025', 26.826, 75.862),
      L('Tonk Road', '302015', 26.85, 75.8), L('Bani Park', '302016', 26.931, 75.79), L('Vidhyadhar Nagar', '302039', 26.957, 75.776),
    ],
  },
  {
    slug: 'ranchi', name: 'Ranchi', state: 'Jharkhand', council: 'JMC', lat: 23.3441, lng: 85.3096, pincodePrefixes: ['834', '835'], aliases: [], tier: 2,
    localities: [
      L('Lalpur', '834001', 23.37, 85.33), L('Harmu', '834012', 23.35, 85.31), L('Doranda', '834002', 23.335, 85.32),
      L('Kanke Road', '834008', 23.4, 85.32), L('Bariatu', '834009', 23.38, 85.35), L('Ashok Nagar', '834002', 23.349, 85.305),
      L('Morabadi', '834008', 23.39, 85.33), L('Hinoo', '834002', 23.33, 85.3), L('Kokar', '834001', 23.37, 85.36),
    ],
  },
  {
    slug: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', council: 'UPMC', lat: 26.8467, lng: 80.9462, pincodePrefixes: ['226', '227'], aliases: [], tier: 2,
    localities: [
      L('Gomti Nagar', '226010', 26.85, 81.0), L('Hazratganj', '226001', 26.85, 80.946), L('Aliganj', '226024', 26.89, 80.94),
      L('Indira Nagar', '226016', 26.88, 80.99), L('Alambagh', '226005', 26.81, 80.9), L('Aminabad', '226018', 26.845, 80.928),
      L('Mahanagar', '226006', 26.875, 80.955), L('Jankipuram', '226021', 26.92, 80.94), L('Vikas Nagar', '226022', 26.895, 80.96),
    ],
  },
  {
    slug: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh', council: 'PMC', lat: 30.7333, lng: 76.7794, pincodePrefixes: ['160', '140', '134'], aliases: ['tricity'], tier: 2,
    localities: [
      L('Sector 17', '160017', 30.741, 76.779), L('Sector 22', '160022', 30.733, 76.772), L('Sector 35', '160035', 30.725, 76.758),
      L('Sector 8', '160009', 30.747, 76.796), L('Manimajra', '160101', 30.72, 76.835), L('Sector 43', '160043', 30.718, 76.75),
      L('Mohali Phase 7', '160062', 30.71, 76.72), L('Panchkula Sector 5', '134109', 30.694, 76.86), L('Zirakpur', '140603', 30.642, 76.817),
    ],
  },
  {
    slug: 'kochi', name: 'Kochi', state: 'Kerala', council: 'TCMC', lat: 9.9312, lng: 76.2673, pincodePrefixes: ['682', '683'], aliases: ['cochin', 'ernakulam'], tier: 2,
    localities: [
      L('Edappally', '682024', 10.024, 76.308), L('Kakkanad', '682030', 10.016, 76.342), L('Vyttila', '682019', 9.967, 76.318),
      L('MG Road Kochi', '682016', 9.971, 76.283), L('Kaloor', '682017', 9.996, 76.292), L('Palarivattom', '682025', 10.004, 76.304),
      L('Fort Kochi', '682001', 9.965, 76.242), L('Aluva', '683101', 10.108, 76.352), L('Panampilly Nagar', '682036', 9.958, 76.296),
    ],
  },
  {
    slug: 'indore', name: 'Indore', state: 'Madhya Pradesh', council: 'MPMC', lat: 22.7196, lng: 75.8577, pincodePrefixes: ['452', '453'], aliases: [], tier: 2,
    localities: [
      L('Vijay Nagar', '452010', 22.753, 75.893), L('Palasia', '452001', 22.725, 75.884), L('Rajwada', '452002', 22.718, 75.855),
      L('Bhawarkua', '452014', 22.693, 75.868), L('Sudama Nagar', '452009', 22.697, 75.834), L('AB Road', '452008', 22.74, 75.89),
      L('Nipania', '452016', 22.768, 75.916), L('Rau', '453331', 22.636, 75.812), L('Scheme 54', '452011', 22.751, 75.896),
    ],
  },
  {
    slug: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', council: 'MPMC', lat: 23.2599, lng: 77.4126, pincodePrefixes: ['462'], aliases: [], tier: 2,
    localities: [
      L('MP Nagar', '462011', 23.233, 77.434), L('Arera Colony', '462016', 23.215, 77.433), L('Kolar Road', '462042', 23.18, 77.415),
      L('Hoshangabad Road', '462026', 23.19, 77.46), L('Shahpura', '462039', 23.197, 77.42), L('New Market', '462003', 23.235, 77.401),
      L('Bairagarh', '462030', 23.275, 77.34), L('Awadhpuri', '462022', 23.235, 77.495), L('Karond', '462038', 23.3, 77.39),
    ],
  },
  {
    slug: 'patna', name: 'Patna', state: 'Bihar', council: 'BMC', lat: 25.5941, lng: 85.1376, pincodePrefixes: ['800', '801'], aliases: [], tier: 2,
    localities: [
      L('Boring Road', '800001', 25.615, 85.11), L('Kankarbagh', '800020', 25.595, 85.16), L('Rajendra Nagar', '800016', 25.6, 85.15),
      L('Bailey Road', '800014', 25.61, 85.09), L('Patliputra Colony', '800013', 25.623, 85.103), L('Gandhi Maidan', '800004', 25.618, 85.145),
      L('Danapur', '801503', 25.63, 85.046), L('Anisabad', '800002', 25.587, 85.1), L('Kurji', '800010', 25.638, 85.09),
    ],
  },
  {
    slug: 'nagpur', name: 'Nagpur', state: 'Maharashtra', council: 'MMC', lat: 21.1458, lng: 79.0882, pincodePrefixes: ['440', '441'], aliases: [], tier: 2,
    localities: [
      L('Dharampeth', '440010', 21.14, 79.07), L('Sitabuldi', '440012', 21.145, 79.085), L('Sadar', '440001', 21.16, 79.08),
      L('Manish Nagar', '440015', 21.085, 79.065), L('Pratap Nagar', '440022', 21.115, 79.055), L('Wardhaman Nagar', '440008', 21.15, 79.13),
      L('Ramdaspeth', '440011', 21.135, 79.078), L('Civil Lines', '440002', 21.155, 79.07), L('Trimurti Nagar', '440025', 21.125, 79.05),
    ],
  },
  {
    slug: 'surat', name: 'Surat', state: 'Gujarat', council: 'GMC', lat: 21.1702, lng: 72.8311, pincodePrefixes: ['394', '395'], aliases: [], tier: 2,
    localities: [
      L('Adajan', '395009', 21.195, 72.795), L('Vesu', '395007', 21.14, 72.775), L('Athwa', '395001', 21.18, 72.81),
      L('Piplod', '395017', 21.155, 72.78), L('Varachha', '395006', 21.21, 72.86), L('Citylight', '395010', 21.165, 72.795),
      L('Pal', '395009', 21.2, 72.77), L('Katargam', '395004', 21.228, 72.835), L('Udhna', '394210', 21.16, 72.85),
    ],
  },
  {
    slug: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', council: 'TNMC', lat: 11.0168, lng: 76.9558, pincodePrefixes: ['641'], aliases: ['kovai'], tier: 2,
    localities: [
      L('RS Puram', '641002', 11.007, 76.95), L('Gandhipuram', '641012', 11.018, 76.967), L('Peelamedu', '641004', 11.03, 77.01),
      L('Saibaba Colony', '641011', 11.024, 76.942), L('Race Course', '641018', 11.0, 76.978), L('Singanallur', '641005', 10.999, 77.03),
      L('Saravanampatti', '641035', 11.08, 77.0), L('Ramanathapuram', '641045', 10.995, 76.995), L('Vadavalli', '641041', 11.025, 76.9),
    ],
  },
  {
    slug: 'noida', name: 'Noida', state: 'Uttar Pradesh', council: 'UPMC', lat: 28.5355, lng: 77.391, pincodePrefixes: ['201'], aliases: ['greater-noida'], tier: 1,
    localities: [
      L('Sector 18', '201301', 28.57, 77.32), L('Sector 62', '201309', 28.627, 77.365), L('Sector 50', '201303', 28.571, 77.368),
      L('Sector 137', '201305', 28.51, 77.407), L('Greater Noida West', '201306', 28.6, 77.43), L('Sector 15', '201302', 28.583, 77.311),
      L('Sector 76', '201304', 28.566, 77.386), L('Sector 104', '201307', 28.54, 77.37), L('Sector 128', '201308', 28.52, 77.35),
    ],
  },
  {
    slug: 'gurgaon', name: 'Gurugram', state: 'Haryana', council: 'HMC', lat: 28.4595, lng: 77.0266, pincodePrefixes: ['122'], aliases: ['gurugram'], tier: 1,
    localities: [
      L('DLF Phase 1', '122002', 28.473, 77.098), L('Sohna Road', '122018', 28.42, 77.04), L('Golf Course Road', '122009', 28.45, 77.1),
      L('Sector 14', '122001', 28.47, 77.04), L('MG Road Gurugram', '122022', 28.48, 77.08), L('Sector 56', '122011', 28.423, 77.1),
      L('Sushant Lok', '122010', 28.46, 77.073), L('Palam Vihar', '122017', 28.51, 77.04), L('Udyog Vihar', '122016', 28.5, 77.085),
    ],
  },
  {
    slug: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', council: 'APMC', lat: 17.6868, lng: 83.2185, pincodePrefixes: ['530', '531'], aliases: ['vizag'], tier: 2,
    localities: [
      L('MVP Colony', '530017', 17.74, 83.33), L('Dwaraka Nagar', '530016', 17.73, 83.305), L('Gajuwaka', '530026', 17.69, 83.21),
      L('Seethammadhara', '530013', 17.74, 83.31), L('Madhurawada', '530048', 17.81, 83.36), L('Beach Road', '530002', 17.715, 83.325),
      L('Asilmetta', '530003', 17.72, 83.31), L('Akkayyapalem', '530020', 17.73, 83.295), L('NAD Junction', '530009', 17.74, 83.235),
    ],
  },
  {
    slug: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha', council: 'OCMR', lat: 20.2961, lng: 85.8245, pincodePrefixes: ['751', '752'], aliases: [], tier: 2,
    localities: [
      L('Saheed Nagar', '751007', 20.29, 85.845), L('Patia', '751024', 20.355, 85.82), L('Nayapalli', '751012', 20.295, 85.815),
      L('Jaydev Vihar', '751013', 20.3, 85.82), L('Khandagiri', '751030', 20.26, 85.78), L('Old Town', '751002', 20.24, 85.835),
      L('Chandrasekharpur', '751016', 20.33, 85.82), L('Rasulgarh', '751010', 20.295, 85.855), L('Baramunda', '751003', 20.28, 85.8),
    ],
  },
  {
    slug: 'guwahati', name: 'Guwahati', state: 'Assam', council: 'AMC', lat: 26.1445, lng: 91.7362, pincodePrefixes: ['781'], aliases: [], tier: 2,
    localities: [
      L('Dispur', '781006', 26.14, 91.79), L('Ganeshguri', '781005', 26.15, 91.785), L('Zoo Road', '781024', 26.17, 91.78),
      L('Paltan Bazaar', '781008', 26.178, 91.755), L('Beltola', '781028', 26.12, 91.8), L('Six Mile', '781022', 26.135, 91.815),
      L('Chandmari', '781003', 26.185, 91.77), L('Uzan Bazar', '781001', 26.19, 91.75), L('Lachit Nagar', '781007', 26.175, 91.756),
    ],
  },
];

export const CITY_BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));

/** URL segment → canonical city slug, following aliases (bengaluru → bangalore). */
export function resolveCitySlug(input: string) {
  const s = input.toLowerCase();
  if (CITY_BY_SLUG.has(s)) return s;
  return CITIES.find((c) => c.aliases.includes(s))?.slug ?? null;
}
