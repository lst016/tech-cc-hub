export type TMessage = {
  id?: string;
  role?: string;
  content?: string;
  createdAt?: number;
  [key: string]: unknown;
};

export const joinPath = (...parts: Array<string | undefined | null>) =>
  parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/:\//, '://');
