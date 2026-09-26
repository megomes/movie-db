// Marca: três cartas empilhadas (a pilha do backlog) sobre fundo escuro.
// Usada tanto no app quanto nos ícones gerados via ImageResponse (só estilos inline).
export function LogoMark({ size, padded = false }: { size: number; padded?: boolean }) {
  const s = padded ? size * 0.62 : size * 0.78;
  const card = (color: string, rotate: number, dx: number) => (
    <div
      style={{
        position: "absolute",
        width: s * 0.5,
        height: s * 0.7,
        left: (size - s * 0.5) / 2 + dx,
        top: (size - s * 0.7) / 2,
        borderRadius: s * 0.08,
        background: color,
        transform: `rotate(${rotate}deg)`,
        boxShadow: `0 ${s * 0.02}px ${s * 0.06}px rgba(0,0,0,.45)`,
        display: "flex",
      }}
    />
  );
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        background: "#0c0b10",
        borderRadius: padded ? 0 : size * 0.22,
      }}
    >
      {card("#a78bfa", -16, -s * 0.16)}
      {card("#34d399", 14, s * 0.16)}
      {card("#ffcc4d", 0, 0)}
    </div>
  );
}
