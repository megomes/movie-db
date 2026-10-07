// Listas compartilhadas: um "dono" virtual que todo mundo com acesso lê e edita igual.
// Como não existe perfil com esse id, ficam fora do backlog pessoal, das ideias, do "juntos" e dos vistos.
// O id e o título vêm do ambiente (NEXT_PUBLIC_FAMILY_LIST_ID e NEXT_PUBLIC_FAMILY_LIST_TITLE).
export const FAMILY_LIST = process.env.NEXT_PUBLIC_FAMILY_LIST_ID || "shared:family";

export const COLLECTIONS: Record<string, { title: string; subtitle: string }> = {
  [FAMILY_LIST]: {
    title: process.env.NEXT_PUBLIC_FAMILY_LIST_TITLE || "Livros da família",
    subtitle: "Lista da família: o que um adiciona, todo mundo vê.",
  },
};

export const isShared = (ownerId: string) => ownerId in COLLECTIONS;
