/**
 * O bug que já voltou duas vezes: um número DIGITADO e não aplicado.
 *
 * Dentro de um ScrollView com keyboardShouldPersistTaps, tocar num controle vizinho (o ± ao lado,
 * o stepper do imposto, o botão Salvar) NÃO tira o foco do campo — então o `onBlur`, que é quem
 * aplica o valor, nunca roda. O texto some no próximo render e o número nunca chega ao orçamento.
 *
 * O contrato testado aqui: enquanto o campo está focado ele deixa no `commitSlot` uma função que
 * aplica o que está digitado AGORA, e qualquer controle chama essa função antes de agir.
 */
import React from 'react';
// o i18n do ui carrega AsyncStorage, que não existe fora do app
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const renderer = require('react-test-renderer');
const { act } = renderer;
import { TextInput } from 'react-native';
import { MoneyField } from '../../ui';

type Slot = React.MutableRefObject<(() => void) | null>;

function mount(value: number, onApply: (v: number) => void, percent = false) {
  const slot: Slot = { current: null };
  let tree: any;
  act(() => {
    tree = renderer.create(<MoneyField value={value} onApply={onApply} commitSlot={slot} percent={percent} />);
  });
  const input = () => tree.root.findByType(TextInput);
  const focus = () => act(() => { input().props.onFocus?.({} as never); });
  const type = (t: string) => act(() => { input().props.onChangeText(t); });
  return { slot, tree, input, focus, type };
}

describe('MoneyField: o número digitado não pode se perder num toque vizinho', () => {
  it('entrega ao commitSlot o valor que está na tela AGORA (sem blur)', () => {
    const onApply = jest.fn();
    const { slot, focus, type } = mount(0, onApply);
    focus();
    type('300');
    // o dono toca no "+" ao lado: nada blura, mas o controle commita antes de agir
    expect(slot.current).toBeTruthy();
    act(() => slot.current!());
    expect(onApply).toHaveBeenCalledWith(300);
  });

  it('o commit enxerga a ÚLTIMA digitação, não a do momento do foco', () => {
    const onApply = jest.fn();
    const { slot, focus, type } = mount(0, onApply);
    focus();
    type('1');
    type('12');
    type('125');
    act(() => slot.current!());
    expect(onApply).toHaveBeenCalledWith(125);
  });

  it('campo só olhado, sem digitar, não aplica nada', () => {
    const onApply = jest.fn();
    const { slot, focus } = mount(1502.04, onApply);
    focus();
    act(() => slot.current!());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('percentual usa o parser de percentual, não o de dinheiro', () => {
    const onApply = jest.fn();
    const { slot, focus, type } = mount(0, onApply, true);
    focus();
    type('12.567'); // parseMoney leria 12567
    act(() => slot.current!());
    expect(onApply).toHaveBeenCalledWith(12.6);
  });

  it('dinheiro lê a convenção pt/es sem virar 1', () => {
    const onApply = jest.fn();
    const { slot, focus, type } = mount(0, onApply);
    focus();
    type('1.000,50');
    act(() => slot.current!());
    expect(onApply).toHaveBeenCalledWith(1000.5);
  });

  it('valor negativo ou lixo não aplica', () => {
    const onApply = jest.fn();
    const { slot, focus, type } = mount(0, onApply);
    focus();
    type('abc');
    act(() => slot.current!());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('o blur libera o slot (o próximo controle não reaplica um campo já fechado)', () => {
    const onApply = jest.fn();
    const { slot, focus, type, input } = mount(0, onApply);
    focus();
    type('50');
    act(() => { input().props.onBlur?.({} as never); });
    expect(onApply).toHaveBeenCalledWith(50);
    expect(slot.current).toBeNull();
  });
});
