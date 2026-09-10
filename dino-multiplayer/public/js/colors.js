// Paleta compartilhada (cliente + servidor). Cada jogador na sala usa uma cor diferente.
const DINO_COLORS = [
  { id: 'gray',   hex: '#535353', name: 'Clássico' },
  { id: 'green',  hex: '#3d7a45', name: 'Musgo' },
  { id: 'blue',   hex: '#3d5f99', name: 'Rio' },
  { id: 'orange', hex: '#c46b28', name: 'Deserto' },
  { id: 'purple', hex: '#6b4a8c', name: 'Uva' },
  { id: 'red',    hex: '#b4453a', name: 'Argila' },
  { id: 'teal',   hex: '#2e7d70', name: 'Lago' },
  { id: 'brown',  hex: '#6b4e32', name: 'Terra' },
];

function colorById(id) {
  return DINO_COLORS.find((c) => c.id === id) || DINO_COLORS[0];
}

function firstFreeColor(takenIds) {
  const taken = new Set(takenIds.filter(Boolean));
  return (DINO_COLORS.find((c) => !taken.has(c.id)) || DINO_COLORS[0]).id;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DINO_COLORS, colorById, firstFreeColor };
}
