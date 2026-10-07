import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quoteFrom } from '../order.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
// Cenários isolados: os itens do catálogo real permanecem inativos até Wesley cadastrá-los.
catalog.products.forEach(product => { product.available = true; product.fulfillment = 'order'; });
const shirt = (quantity = 1) => ({ productId:'barcelona-2627', size:'G', quantity, personalization:{name:'WESLEY',number:'10'} });
const mug = (quantity = 1) => ({ productId:'caneca-preta', size:'', quantity, personalization:{} });

test('um produto personalizado usa o preço cadastrado e o adicional', () => {
  const quote = quoteFrom({customer:{name:'João Silva',city:'Ribeira do Pombal'},items:[shirt()]},catalog);
  assert.equal(quote.total,214.9);
  assert.match(quote.message,/1x Camisa Barcelona 26\/27\nTamanho: G\nPersonalização: WESLEY 10\nValor: R\$ 214,90/);
  assert.match(quote.message,/Total dos produtos: R\$ 214,90/);
});

test('vários produtos incluem modelo, subtotais e caracteres especiais', () => {
  const note = 'Entrega após às 18h — prédio nº 2 😊';
  const quote = quoteFrom({customer:{name:'João Silva',city:'Ribeira do Pombal',note},items:[shirt(2),mug(1)]},catalog);
  assert.equal(quote.total,469.7);
  assert.match(quote.message,/2x Camisa Barcelona 26\/27[\s\S]*Valor: R\$ 214,90\nSubtotal: R\$ 429,80/);
  assert.match(quote.message,/1x Caneca Personalizada\nModelo: Preta\nValor: R\$ 39,90/);
  assert.match(quote.message,/Total dos produtos: R\$ 469,70/);
  assert.ok(quote.message.includes(`Observação:\n${note}`));
  const url = `https://wa.me/${catalog.settings.whatsapp}?text=${encodeURIComponent(quote.message)}`;
  assert.equal(new URL(url).searchParams.get('text'),quote.message);
});

test('o servidor recalcula valores e rejeita tamanho ou quantidade inválidos', () => {
  const quote = quoteFrom({customer:{name:'Ana',city:'Salvador'},items:[{...shirt(),unitPrice:0}]},catalog);
  assert.equal(quote.total,214.9);
  assert.throws(() => quoteFrom({customer:{name:'Ana',city:'Salvador'},items:[{...shirt(),size:''}]},catalog),/Escolha um tamanho/);
  assert.throws(() => quoteFrom({customer:{name:'Ana',city:'Salvador'},items:[shirt(0)]},catalog),/Quantidade inválida/);
});

test('o orçamento respeita o estoque total e os campos de personalização do painel', () => {
  const current=structuredClone(catalog);
  const product=current.products.find(item=>item.id==='barcelona-2627');
  product.fulfillment='ready';product.stock=2;product.personalizationFields=['name','number'];
  const customer={name:'Ana',city:'Salvador'};
  assert.throws(()=>quoteFrom({customer,items:[shirt(2),{...shirt(1),size:'M'}]},current),/Estoque insuficiente/);
  assert.throws(()=>quoteFrom({customer,items:[{...shirt(),personalization:{phrase:'Frase extra'}}]},current),/não está disponível/);
  assert.equal(quoteFrom({customer,items:[shirt(2)]},current).total,429.8);
});
