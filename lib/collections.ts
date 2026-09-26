// Listas compartilhadas: um "dono" virtual que todo mundo com acesso lê e edita igual.
// Como não existe perfil com esse id, ficam fora do backlog pessoal, das ideias, do "juntos" e dos vistos.
export const FELIPE = "shared:felipe";

export const COLLECTIONS: Record<string, { title: string; subtitle: string }> = {
  [FELIPE]: { title: "Livros para o Felipe", subtitle: "Lista da família: o que um adiciona, todo mundo vê." },
};

export const isShared = (ownerId: string) => ownerId in COLLECTIONS;
