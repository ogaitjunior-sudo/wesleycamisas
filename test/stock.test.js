import test from 'node:test';
import assert from 'node:assert/strict';
import { saleItemsFrom, applySale } from '../stock.js';
import { orderItemsFrom } from '../order.js';
import { sizeStock, cartWithChangedSize } from '../public/sizes.js';

const catalog = { products: [{ id:'shirt', name:'Camisa Real Madrid', category:'Camisas', available:true,
  fulfillment:'ready', sizes:['G','GG','G1'], sizeStock:{G:1,GG:1,G1:1}, stock:3, price:100, customizable:true }] };
const item = (size, quantity = 1) => ({ productId:'shirt', size, quantity });

test('três numerações independentes têm limite próprio e preservam personalizações', () => {
  assert.equal(orderItemsFrom([item('G'),item('GG'),item('G1')],catalog).length,3);
  assert.throws(()=>orderItemsFrom([item('G',3)],catalog),/tamanho G/);
  assert.throws(()=>orderItemsFrom([item('G'),item('G')],catalog),/tamanho G/);
  assert.throws(()=>orderItemsFrom([item('PP')],catalog),/Escolha um tamanho/);
  assert.equal(orderItemsFrom([{...item('G'),personalization:{name:'ANA',number:'10'}}],catalog)[0].personalization.name,'ANA');
});

test('baixa reduz apenas a numeração vendida e reposição restaura a disponibilidade', () => {
  const items=saleItemsFrom([item('G')],catalog);
  const updated=applySale(catalog,items);
  assert.deepEqual(updated.products[0].sizeStock,{G:0,GG:1,G1:1});
  assert.equal(updated.products[0].stock,2);
  assert.equal(catalog.products[0].sizeStock.G,1);
  assert.throws(()=>saleItemsFrom([item('G')],updated),/Estoque insuficiente/);
  updated.products[0].sizeStock.G=2;
  updated.products[0].stock=4;
  assert.equal(saleItemsFrom([item('G',2)],updated)[0].quantity,2);
});

test('estoque legado sem distribuição nunca vira saldo fictício de um tamanho', () => {
  const old={...catalog.products[0],sizeStock:undefined,stock:20};
  assert.equal(sizeStock(old,'G'),0);
  assert.throws(()=>saleItemsFrom([item('G')],{products:[old]}),/Estoque insuficiente/);
});

test('troca de tamanho na sacola respeita o saldo e mantém personalização', () => {
  const personalization={name:'ANA',number:'10'};
  const cart=[{...item('G'),personalization,key:JSON.stringify(['shirt','G',personalization])}];
  const changed=cartWithChangedSize(cart,catalog.products,0,'GG');
  assert.equal(changed[0].size,'GG');
  assert.deepEqual(changed[0].personalization,personalization);
  assert.equal(cart[0].size,'G');
  assert.throws(()=>cartWithChangedSize([...cart,item('GG')],catalog.products,0,'GG'),/apenas 0 unidade/);
  assert.throws(()=>cartWithChangedSize(cart,catalog.products,0,'PP'),/indisponível/);
});
