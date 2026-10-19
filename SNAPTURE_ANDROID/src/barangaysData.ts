export const BARANGAY_DISTRICTS = [
  {
    title: 'District 1: Bacoor West',
    data: [
      'Aniban 1', 'Aniban 2', 'Bayanan', 'Dulong Bayan', 'Habay 1', 'Habay 2',
      'Kaingin Digman', 'Ligas 1', 'Ligas 2', 'Mabolo', 'Maliksi 1', 'Maliksi 2',
      'Mambog 1', 'Mambog 2', 'Mambog 3', 'Mambog 4', 'Niog', 'Poblacion', 'Real',
      'Salinas 1', 'Salinas 2', 'Sinbanali', 'Talaba 1',
    ],
  },
  {
    title: 'District 2: Bacoor East',
    data: [
      'Molino 1', 'Molino 2', 'Molino 3', 'Molino 4', 'Molino 5', 'Molino 6', 'Molino 7',
      'P.F. Espiritu 1', 'P.F. Espiritu 2', 'P.F. Espiritu 3', 'P.F. Espiritu 4',
      'P.F. Espiritu 5', 'P.F. Espiritu 6', 'Queens Row Central', 'Queens Row East',
      'Queens Row West', 'San Nicolas 1', 'San Nicolas 2', 'San Nicolas 3',
      'Talaba 2', 'Talaba 3', 'Zapote 1', 'Zapote 2', 'Zapote 3',
    ],
  },
];

// The supplied list has 47 names (23 West / 24 East). Do not invent a 48th.
const BARANGAY_NAMES = new Set(BARANGAY_DISTRICTS.flatMap(district => district.data));
export const isBarangay = (value: string) => BARANGAY_NAMES.has(value);
export function filterBarangays(search: string) {
  const query = search.trim().toLowerCase();
  return BARANGAY_DISTRICTS.map(district => ({
    title: district.title,
    data: district.data.filter(name => name.toLowerCase().includes(query)),
  })).filter(district => district.data.length > 0);
}
