const foodTranslations: Array<[RegExp, string]> = [
  [/green salad with/gi, 'Yeşil salata ile'],
  [/roasted potato wedges?/gi, 'Fırın patates dilimleri'],
  [/roasted potatoes?/gi, 'Fırın patates'],
  [/boiled chickpeas?/gi, 'Haşlanmış nohut'],
  [/chickpeas?/gi, 'Nohut'],
  [/cucumber rolls?/gi, 'Salatalık ruloları'],
  [/cucumbers?/gi, 'Salatalık'],
  [/cucumber/gi, 'Salatalık'],
  [/tomatoes?/gi, 'Domates'],
  [/chicken breast/gi, 'Tavuk göğsü'],
  [/chicken/gi, 'Tavuk'],
  [/curd cheese|cottage cheese/gi, 'Lor peyniri'],
  [/yogurt/gi, 'Yoğurt'],
  [/bread/gi, 'Ekmek'],
  [/eggs?/gi, 'Yumurta'],
  [/avocado/gi, 'Avokado'],
  [/olives?/gi, 'Zeytin'],
  [/walnuts?/gi, 'Ceviz'],
  [/banana/gi, 'Muz'],
  [/hummus/gi, 'Humus'],
  [/broccoli/gi, 'Brokoli'],
  [/potatoes?/gi, 'Patates'],
  [/rice/gi, 'Pirinç'],
  [/\band\b/gi, 've'],
  [/with/gi, 'ile'],
];

export function localizeFoodName(value: string): string {
  let result = value.trim();
  for (const [pattern, translation] of foodTranslations) result = result.replace(pattern, translation);
  return result || 'Bilinmeyen malzeme';
}

export function localizeMealName(value: string): string {
  return value.trim()
    .replace(/breakfast/gi, 'Kahvaltı')
    .replace(/lunch/gi, 'Öğle yemeği')
    .replace(/dinner/gi, 'Akşam yemeği')
    .replace(/snack/gi, 'Ara öğün')
    .replace(/plate/gi, 'tabağı');
}
// Translates English or mixed-language AI food names into Turkish UI labels.
