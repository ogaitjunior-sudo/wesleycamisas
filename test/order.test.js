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
  assert.match(quote.message,/Produto: Camisa Barcelona 26\/27\nTamanho: G\nPersonalização: WESLEY 10\nQuantidade: 1\nPreço unitário: R\$ 214,90/);
  assert.match(quote.message,/SUBTOTAL: R\$ 214,90/);
  assert.match(quote.message,/Frete: a combinar/);
});

test('vários produtos incluem modelo, subtotais e caracteres especiais', () => {
  const note = 'Entrega após às 18h — prédio nº 2 😊';
  const quote = quoteFrom({customer:{name:'João Silva',city:'Ribeira do Pombal',note},items:[shirt(2),mug(1)]},catalog);
  assert.equal(quote.total,469.7);
  assert.match(quote.message,/Produto: Camisa Barcelona 26\/27[\s\S]*Quantidade: 2\nPreço unitário: R\$ 214,90\nSubtotal do item: R\$ 429,80/);
  assert.match(quote.message,/Produto: Caneca Personalizada\nModelo: Preta\nQuantidade: 1\nPreço unitário: R\$ 39,90/);
  assert.match(quote.message,/SUBTOTAL: R\$ 469,70/);
  assert.ok(quote.message.includes(`Observação: ${note}`));
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

test('o mesmo produto aceita tamanhos diferentes e limita o estoque de cada tamanho', () => {
  const current=structuredClone(catalog);
  const product=current.products.find(item=>item.id==='barcelona-2627');
  product.sizes=['M','G','GG','G1'];
  product.sizeStock={M:2,G:1,GG:0,G1:3};
  product.fulfillment='ready';product.stock=6;
  const customer={name:'Ana',city:'Salvador'};
  const items=[{...shirt(1),size:'M'},{...shirt(1),size:'G'}];
  const quote=quoteFrom({customer,items},current);
  assert.equal(quote.items.length,2);
  assert.match(quote.message,/Tamanho: M/);
  assert.match(quote.message,/Tamanho: G/);
  assert.throws(()=>quoteFrom({customer,items:[shirt(1),shirt(1)]},current),/tamanho G/);
  assert.throws(()=>quoteFrom({customer,items:[{...shirt(),size:'GG'}]},current),/tamanho GG/);
  assert.throws(()=>quoteFrom({customer,items:[{...shirt(),size:'PP'}]},current),/Escolha um tamanho/);
});

test('pedido com dados completos preserva contato e endereço no WhatsApp', () => {
  const customer={name:'Ana Souza',phone:'(71) 99999-9999',postalCode:'40000-000',street:'Rua das Flores',number:'12',complement:'Casa 2',district:'Centro',city:'Salvador',state:'BA'};
  const quote=quoteFrom({customer,items:[shirt()]},catalog);
  assert.match(quote.message,/WhatsApp do cliente: 71999999999/);
  assert.match(quote.message,/CEP de destino: 40000-000/);
  assert.match(quote.message,/Endereço: Rua das Flores, 12 — Casa 2 — Centro/);
  assert.match(quote.message,/TOTAL DO PEDIDO: a confirmar/);
  assert.throws(()=>quoteFrom({customer:{...customer,number:''},items:[shirt()]},catalog),/rua, número e bairro/);
});
