export const getColorFromRelation = (relation: string): string => {
  const relationColors: Record<string, string> = {
    background: 'blue',
    method: 'green',
    gap: 'red',
    future: 'violet',
    objective: 'orange',
  };

  const key = relation.toLowerCase();
  return relationColors[key] || 'gray'; // fallback ke 'gray' jika tidak cocok
};
