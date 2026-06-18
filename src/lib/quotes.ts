// Julius Caesar — for the intro sequence. Each has the Latin line and a
// Russian rendering shown beneath it.
export interface Quote {
  latin: string;
  ru: string;
}

export const CAESAR_QUOTES: Quote[] = [
  { latin: "Veni, vidi, vici.", ru: "Пришёл, увидел, победил." },
  { latin: "Alea iacta est.", ru: "Жребий брошен." },
  {
    latin: "Experientia docet.",
    ru: "Опыт учит.",
  },
  {
    latin: "Faciles motus mentis.",
    ru: "Каждый сам кузнец своей судьбы.",
  },
  {
    latin: "Qui non est hodie, cras minus aptus erit.",
    ru: "Кто не готов сегодня, завтра будет готов ещё меньше.",
  },
];

export const CAESAR_TITLE = "GAIVS·IVLIVS·CAESAR";
