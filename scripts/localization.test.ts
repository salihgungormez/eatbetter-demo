import assert from 'node:assert/strict';
import { localizeFoodName, localizeMealName } from '@/utils/localization';

assert.equal(localizeFoodName('Green Salad with Chickpeas'), 'Yeşil salata ile Nohut');
assert.equal(localizeFoodName('Roasted potatoes'), 'Fırın patates');
assert.equal(localizeFoodName('Roasted Potato Wedges'), 'Fırın patates dilimleri');
assert.equal(localizeFoodName('Boiled Chickpeas'), 'Haşlanmış nohut');
assert.equal(localizeFoodName('Tomatoes and Cucumbers'), 'Domates ve Salatalık');
assert.equal(localizeMealName('Breakfast plate'), 'Kahvaltı tabağı');
console.log('localization: ok');
// Verifies that English food names from the AI are localized in the user interface.
