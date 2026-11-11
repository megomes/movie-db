import { redirect } from "next/navigation";

// O Meu Switch virou o grupo "Instalados" da aba Jogos
export default function SwitchPage() {
  redirect("/lista?k=game");
}
