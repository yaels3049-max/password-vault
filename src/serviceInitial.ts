const GRADIENTS = [
  'linear-gradient(135deg, #5b8def 0%, #3b6fd4 100%)',
  'linear-gradient(135deg, #7c6fe0 0%, #5a4fcf 100%)',
  'linear-gradient(135deg, #4db6ac 0%, #2a9d8f 100%)',
  'linear-gradient(135deg, #f0925c 0%, #e07a3a 100%)',
  'linear-gradient(135deg, #e0719e 0%, #c4527d 100%)',
  'linear-gradient(135deg, #6bbf7b 0%, #4a9d5c 100%)',
  'linear-gradient(135deg, #7da3c9 0%, #5b7fa8 100%)',
  'linear-gradient(135deg, #b088d8 0%, #8c64b8 100%)',
];

export function getServiceInitial(name: string): string {
  const latin = name.match(/[A-Za-z]/);
  if (latin) return latin[0].toUpperCase();

  const words = name.trim().split(/\s+/).filter(Boolean);
  const word = words.length > 1 ? words[words.length - 1] : words[0];
  return word?.[0] ?? '?';
}

export function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
