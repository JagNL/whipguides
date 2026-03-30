// ─── Guide Verticals Configuration ──────────────────────────────────────────

function yearRange() {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 1979 }, (_, i) => String(current - i));
}

export interface VerticalSubject {
  label: string;
  field: string;
  type: "text" | "select";
  placeholder?: string;
  options?: string[];
}

export interface GuideVertical {
  key: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  subjects: VerticalSubject[];
  categories: string[];
  tools: string[];
  compliance?: string;
}

export const GUIDE_VERTICALS: GuideVertical[] = [
  {
    key: "automotive",
    label: "Automotive",
    icon: "Car",
    description: "Cars, trucks, SUVs, classics",
    color: "from-blue-600/20 to-blue-900/20",
    subjects: [
      { label: "Make", field: "make", type: "text", placeholder: "e.g. Ford, Chevrolet, Toyota" },
      { label: "Model", field: "model", type: "text", placeholder: "e.g. Mustang, Camaro, Tacoma" },
      { label: "Year From", field: "year_start", type: "select", options: yearRange() },
      { label: "Year To", field: "year_end", type: "select", options: yearRange() },
      { label: "Engine", field: "engine", type: "text", placeholder: "e.g. 5.0L V8, LS3, 2JZ" },
    ],
    categories: ["Engine", "Transmission", "Brakes", "Suspension", "Electrical", "Interior", "Exterior", "Maintenance", "Performance", "Diagnostics", "Other"],
    tools: ["Socket set", "Torque wrench", "Jack stands", "Floor jack", "Oil drain pan", "Multimeter", "Breaker bar"],
  },
  {
    key: "powersports",
    label: "Powersports",
    icon: "Waves",
    description: "ATVs, jet skis, boats, motorcycles, snowmobiles",
    color: "from-teal-600/20 to-teal-900/20",
    subjects: [
      { label: "Type", field: "type", type: "select", options: ["ATV/UTV", "Jet Ski / PWC", "Boat", "Motorcycle", "Dirt Bike", "Snowmobile", "Other"] },
      { label: "Make", field: "make", type: "text", placeholder: "e.g. Yamaha, Sea-Doo, Can-Am" },
      { label: "Model", field: "model", type: "text", placeholder: "e.g. YXZ1000R, Spark, Maverick" },
      { label: "Year", field: "year_start", type: "select", options: yearRange() },
    ],
    categories: ["Engine", "Drivetrain", "Electrical", "Body/Hull", "Maintenance", "Performance", "Safety", "Other"],
    tools: ["Socket set", "Torque wrench", "Impeller tool", "Compression tester"],
  },
  {
    key: "firearms",
    label: "Firearms",
    icon: "Target",
    description: "Maintenance, upgrades, builds",
    color: "from-orange-600/20 to-orange-900/20",
    subjects: [
      { label: "Type", field: "type", type: "select", options: ["Handgun", "Rifle", "Shotgun", "AR Platform", "Bolt Action", "Revolver", "Other"] },
      { label: "Manufacturer", field: "make", type: "text", placeholder: "e.g. Glock, Ruger, S&W" },
      { label: "Model", field: "model", type: "text", placeholder: "e.g. 19, 10/22, M&P" },
      { label: "Caliber", field: "caliber", type: "text", placeholder: "e.g. 9mm, .223, .308" },
    ],
    categories: ["Cleaning", "Upgrades", "Trigger Work", "Optics", "Grips/Stocks", "Ammo", "Safety", "Other"],
    tools: ["Punch set", "Armorer's block", "Cleaning kit", "Torque wrench"],
    compliance: "firearms",
  },
  {
    key: "music",
    label: "Music & Audio",
    icon: "Music2",
    description: "Guitars, gear, studio equipment",
    color: "from-purple-600/20 to-purple-900/20",
    subjects: [
      { label: "Instrument/Gear Type", field: "type", type: "select", options: ["Guitar", "Bass", "Drums", "Keyboard/Synth", "Audio Interface", "Amplifier", "Effects Pedals", "Studio Gear", "Other"] },
      { label: "Brand", field: "make", type: "text", placeholder: "e.g. Gibson, Fender, Roland" },
      { label: "Model", field: "model", type: "text", placeholder: "e.g. Les Paul, Stratocaster, TR-808" },
    ],
    categories: ["Setup", "Repairs", "Upgrades", "Electronics", "Wiring", "Maintenance", "Recording", "Other"],
    tools: ["Soldering iron", "Multimeter", "Screwdriver set", "String winder", "Nut files"],
  },
  {
    key: "maker",
    label: "Maker / 3D Printing",
    icon: "Cpu",
    description: "3D printing, CNC, electronics, fabrication",
    color: "from-green-600/20 to-green-900/20",
    subjects: [
      { label: "Project Type", field: "type", type: "select", options: ["3D Printing", "CNC", "Laser Cutting", "Electronics", "Woodworking", "Metal Fabrication", "Welding", "Other"] },
      { label: "Machine/Tool Brand", field: "make", type: "text", placeholder: "e.g. Bambu Lab, Prusa, Shapeoko" },
      { label: "Model", field: "model", type: "text", placeholder: "e.g. X1C, MK4, Pro5" },
    ],
    categories: ["Setup", "Calibration", "Maintenance", "Upgrades", "Materials", "Software", "Troubleshooting", "Other"],
    tools: ["Calipers", "Hex key set", "Soldering iron", "Multimeter"],
  },
  {
    key: "outdoors",
    label: "Outdoors",
    icon: "Trophy",
    description: "Hunting, fishing, camping, overlanding",
    color: "from-emerald-600/20 to-emerald-900/20",
    subjects: [
      { label: "Activity", field: "type", type: "select", options: ["Hunting", "Fishing", "Camping", "Overlanding", "Hiking", "Off-Roading", "Archery", "Other"] },
      { label: "Subject", field: "subject", type: "text", placeholder: "e.g. Trail camera, Fishing rod, Bow" },
    ],
    categories: ["Gear Setup", "Maintenance", "Modifications", "Techniques", "Safety", "Other"],
    tools: ["Multi-tool", "Cleaning kit"],
  },
  {
    key: "general",
    label: "General",
    icon: "Wrench",
    description: "Home improvement, appliances, anything else",
    color: "from-slate-600/20 to-slate-900/20",
    subjects: [
      { label: "Subject", field: "subject", type: "text", placeholder: "What is this guide about?" },
    ],
    categories: ["How-To", "Repair", "Maintenance", "Install", "DIY", "Other"],
    tools: [],
  },
];

export function getVertical(key: string): GuideVertical | undefined {
  return GUIDE_VERTICALS.find(v => v.key === key);
}

export function detectEmbedUrl(url: string): { type: "youtube" | "instagram" | null; label: string | null } {
  if (!url) return { type: null, label: null };
  if (/youtube\.com\/watch\?v=|youtu\.be\//.test(url)) return { type: "youtube", label: "YouTube video detected" };
  if (/instagram\.com\/p\//.test(url)) return { type: "instagram", label: "Instagram post detected" };
  return { type: null, label: null };
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}
