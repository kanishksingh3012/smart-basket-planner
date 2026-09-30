/**
 * Curated recipe base (original content, MIT) tuned for Indian home cooking.
 * Ingredient keys map to catalogue search queries. Quantities are packs needed for 2 servings;
 * "p" marks a pantry staple (salt, oil, spices) that most kitchens already have.
 */

export type Ingredient = { key: string; label: string; query: string; pantry: boolean; veg: boolean };

// key: [label, search query, flags] — flags: "p" pantry, "n" non-veg
const I: Record<string, [string, string, string?]> = {
  hakka_noodles: ["Hakka noodles", "hakka noodles"],
  basmati: ["Basmati rice", "basmati rice"],
  paneer: ["Paneer", "paneer"],
  cabbage: ["Cabbage", "cabbage"],
  capsicum: ["Capsicum", "capsicum"],
  carrot: ["Carrot", "carrot"],
  spring_onion: ["Spring onion", "spring onion"],
  onion: ["Onion", "onion"],
  tomato: ["Tomato", "tomato"],
  garlic: ["Garlic", "garlic"],
  ginger: ["Ginger", "ginger"],
  green_chilli: ["Green chilli", "green chilli"],
  mushroom: ["Mushroom", "mushroom"],
  potato: ["Potato", "potato"],
  lemon: ["Lemon", "lemon"],
  coriander: ["Coriander leaves", "coriander leaves"],
  curry_leaves: ["Curry leaves", "curry leaves"],
  soy: ["Soy sauce", "soy sauce"],
  chilli_sauce: ["Red chilli sauce", "red chilli sauce"],
  vinegar: ["Vinegar", "vinegar"],
  cornflour: ["Cornflour", "cornflour"],
  chicken: ["Chicken", "chicken breast", "n"],
  egg: ["Eggs", "eggs", "n"],
  butter: ["Butter", "butter"],
  cream: ["Fresh cream", "fresh cream"],
  curd: ["Curd", "curd"],
  milk: ["Milk", "milk"],
  tomato_puree: ["Tomato puree", "tomato puree"],
  toor: ["Toor dal", "toor dal"],
  chana: ["Kabuli chana", "kabuli chana"],
  rajma: ["Rajma", "rajma"],
  chole_masala: ["Chole masala", "chole masala"],
  atta: ["Atta", "atta"],
  dosa_batter: ["Dosa batter", "dosa batter"],
  coconut: ["Grated coconut", "coconut"],
  rava: ["Sooji rava", "sooji rava"],
  poha: ["Poha", "poha"],
  peanuts: ["Peanuts", "peanuts"],
  pasta: ["Penne pasta", "penne pasta"],
  pasta_sauce: ["Pasta sauce", "pasta sauce"],
  cheese: ["Mozzarella cheese", "mozzarella cheese"],
  pizza_base: ["Pizza base", "pizza base"],
  thai_paste: ["Thai green curry paste", "thai green curry paste"],
  coconut_milk: ["Coconut milk", "coconut milk"],
  pancake_mix: ["Pancake mix", "pancake mix"],
  honey: ["Honey", "honey"],
  tortilla: ["Tortillas", "tortilla"],
  kidney_beans: ["Baked beans", "baked beans"],
  salsa: ["Salsa dip", "salsa"],
  oil: ["Cooking oil", "sunflower oil", "p"],
  olive_oil: ["Olive oil", "olive oil", "p"],
  salt: ["Salt", "salt", "p"],
  sugar: ["Sugar", "sugar", "p"],
  turmeric: ["Turmeric", "turmeric powder", "p"],
  chilli_powder: ["Red chilli powder", "red chilli powder", "p"],
  jeera: ["Jeera", "jeera", "p"],
  garam: ["Garam masala", "garam masala", "p"],
  kasuri: ["Kasuri methi", "kasuri methi", "p"],
  oregano: ["Oregano", "oregano", "p"],
  mustard: ["Mustard seeds", "mustard seeds", "p"],
};

export const INGREDIENTS: Record<string, Ingredient> = Object.fromEntries(
  Object.entries(I).map(([key, [label, query, f = ""]]) => [key, { key, label, query, pantry: f.includes("p"), veg: !f.includes("n") }]),
);

export type Course = "main" | "side" | "starter" | "breakfast" | "snack";
export type Recipe = {
  id: string;
  name: string;
  cuisine: string;
  course: Course;
  veg: boolean;
  aliases: string[];
  /** Packs for 2 servings. */
  items: { key: string; per2: number }[];
  source: "curated" | "themealdb";
};

// [name, cuisine, course, aliases (| separated), "key:packs key:packs …"]
const R: [string, string, Course, string, string][] = [
  ["Veg Hakka Noodles", "chinese", "main", "hakka noodles|veg noodles|chow mein|noodles", "hakka_noodles:1 cabbage:1 capsicum:1 carrot:1 spring_onion:1 garlic:1 soy:1 vinegar:1 oil:1 salt:1"],
  ["Veg Fried Rice", "chinese", "main", "fried rice|veg fried rice", "basmati:1 carrot:1 capsicum:1 spring_onion:1 garlic:1 soy:1 oil:1 salt:1"],
  ["Chilli Paneer", "chinese", "side", "chilli paneer|paneer chilli", "paneer:1 capsicum:1 onion:1 garlic:1 soy:1 chilli_sauce:1 cornflour:1 oil:1"],
  ["Veg Manchurian", "chinese", "side", "manchurian|gobi manchurian", "cabbage:1 carrot:1 spring_onion:1 cornflour:1 garlic:1 ginger:1 soy:1 chilli_sauce:1 oil:1"],
  ["Chilli Mushroom", "chinese", "starter", "chilli mushroom", "mushroom:1 capsicum:1 onion:1 garlic:1 soy:1 chilli_sauce:1 cornflour:1 oil:1"],
  ["Chicken Fried Rice", "chinese", "main", "chicken fried rice", "basmati:1 chicken:1 egg:1 spring_onion:1 garlic:1 soy:1 oil:1 salt:1"],
  ["Chilli Chicken", "chinese", "side", "chilli chicken", "chicken:1 capsicum:1 onion:1 garlic:1 soy:1 chilli_sauce:1 cornflour:1 oil:1"],
  ["Paneer Butter Masala", "indian", "main", "paneer butter masala|paneer makhani|butter paneer", "paneer:1 tomato:1 onion:1 butter:1 cream:1 ginger:1 garlic:1 kasuri:1 garam:1 chilli_powder:1 salt:1"],
  ["Dal Tadka", "indian", "main", "dal tadka|dal fry|dal", "toor:1 tomato:1 onion:1 garlic:1 green_chilli:1 jeera:1 turmeric:1 oil:1 salt:1"],
  ["Jeera Rice", "indian", "side", "jeera rice|rice", "basmati:1 jeera:1 oil:1 salt:1"],
  ["Chole", "indian", "main", "chole|chana masala|chole bhature", "chana:1 onion:1 tomato:1 ginger:1 garlic:1 chole_masala:1 oil:1 salt:1"],
  ["Rajma Chawal", "indian", "main", "rajma|rajma chawal", "rajma:1 basmati:1 onion:1 tomato:1 ginger:1 garlic:1 garam:1 oil:1 salt:1"],
  ["Butter Chicken", "indian", "main", "butter chicken|murgh makhani", "chicken:1 tomato_puree:1 butter:1 cream:1 ginger:1 garlic:1 kasuri:1 garam:1 salt:1"],
  ["Aloo Paratha", "indian", "breakfast", "aloo paratha|paratha", "atta:1 potato:1 green_chilli:1 coriander:1 butter:1 curd:1 salt:1"],
  ["Phulka Roti", "indian", "side", "roti|chapati|phulka", "atta:1 salt:1"],
  ["Masala Dosa", "south indian", "breakfast", "dosa|masala dosa", "dosa_batter:1 potato:1 onion:1 curry_leaves:1 mustard:1 turmeric:1 coconut:1 oil:1"],
  ["Upma", "south indian", "breakfast", "upma|rava upma", "rava:1 onion:1 green_chilli:1 curry_leaves:1 mustard:1 peanuts:1 oil:1 salt:1"],
  ["Poha", "indian", "breakfast", "poha|kanda poha", "poha:1 onion:1 peanuts:1 curry_leaves:1 lemon:1 turmeric:1 mustard:1 oil:1"],
  ["Masala Omelette", "indian", "breakfast", "omelette|omelet|egg bhurji", "egg:1 onion:1 tomato:1 green_chilli:1 coriander:1 butter:1 salt:1"],
  ["Penne Arrabbiata", "italian", "main", "arrabbiata|red sauce pasta|pasta", "pasta:1 pasta_sauce:1 garlic:1 olive_oil:1 oregano:1 cheese:1"],
  ["White Sauce Pasta", "italian", "main", "white sauce pasta|alfredo", "pasta:1 milk:1 butter:1 cheese:1 mushroom:1 garlic:1 oregano:1"],
  ["Margherita Pizza", "italian", "main", "pizza|margherita", "pizza_base:1 pasta_sauce:1 cheese:1 oregano:1"],
  ["Thai Green Curry", "thai", "main", "thai curry|green curry", "thai_paste:1 coconut_milk:1 mushroom:1 capsicum:1 basmati:1"],
  ["Veg Burrito Bowl", "mexican", "main", "burrito|burrito bowl", "basmati:1 kidney_beans:1 capsicum:1 onion:1 tomato:1 salsa:1 cheese:1 lemon:1"],
  ["Quesadilla", "mexican", "side", "quesadilla", "tortilla:1 cheese:1 capsicum:1 onion:1 salsa:1"],
  ["Pancakes", "continental", "breakfast", "pancakes|pancake", "pancake_mix:1 milk:1 egg:1 butter:1 honey:1"],
];

export const CURATED: Recipe[] = R.map(([name, cuisine, course, aliases, items]) => {
  const parsed = items.split(" ").map((s) => {
    const [key, n] = s.split(":");
    return { key, per2: Number(n) };
  });
  return {
    id: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    name,
    cuisine,
    course,
    veg: parsed.every((i) => INGREDIENTS[i.key]?.veg !== false),
    aliases: aliases.split("|"),
    items: parsed,
    source: "curated" as const,
  };
});

export const CUISINES = ["indian", "chinese", "south indian", "italian", "thai", "mexican", "continental"] as const;
