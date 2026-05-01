export const uuid = (size = 16) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let i = 0; i < size; i += 1) output += chars[Math.floor(Math.random() * chars.length)];
  return output;
};
