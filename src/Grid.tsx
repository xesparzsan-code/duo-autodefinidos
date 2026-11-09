import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ArrowKind, Puzzle } from './puzzles';
import { key } from './puzzles';
import type { Cells, Derived } from './logic';
import { alpha, fonts, type Theme } from './theme';

function Arrow({ kind, s, color }: { kind: ArrowKind; s: number; color: string }) {
  const t = Math.max(3, s * 0.085);
  const arm = s * 0.17;
  const off = s * 0.2;
  const w = Math.max(1.2, s * 0.03);
  const triRight = { width: 0, height: 0, borderTopWidth: t, borderBottomWidth: t, borderLeftWidth: t * 1.25, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color } as const;
  const triDown = { width: 0, height: 0, borderLeftWidth: t, borderRightWidth: t, borderTopWidth: t * 1.25, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color } as const;
  switch (kind) {
    case 'right':
      return <View pointerEvents="none" style={[triRight, { position: 'absolute', left: 1, top: s / 2 - t }]} />;
    case 'down':
      return <View pointerEvents="none" style={[triDown, { position: 'absolute', top: 1, left: s / 2 - t }]} />;
    case 'right-down':
      return (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: off }}>
          <View style={{ width: arm, height: w, backgroundColor: color }} />
          <View style={[triDown, { marginLeft: arm - t }]} />
        </View>
      );
    case 'left-down':
      return (
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: off, alignItems: 'flex-end' }}>
          <View style={{ width: arm, height: w, backgroundColor: color }} />
          <View style={[triDown, { marginRight: arm - t }]} />
        </View>
      );
    case 'down-right':
      return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: off, flexDirection: 'row' }}>
          <View style={{ height: arm, width: w, backgroundColor: color }} />
          <View style={[triRight, { marginTop: arm - t }]} />
        </View>
      );
    case 'up-right':
      return (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: off, flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ height: arm, width: w, backgroundColor: color }} />
          <View style={[triRight, { marginBottom: arm - t }]} />
        </View>
      );
  }
}

interface LetterProps {
  k: string;
  s: number;
  theme: Theme;
  letter: string;
  arrows: ArrowKind[] | undefined;
  selected: boolean;
  inWord: boolean;
  confirmedColor: string | null;
  hinted: boolean;
  partnerColor: string | null;
  partnerWordColor: string | null;
  flash: boolean;
  onPress: (k: string) => void;
}

const LetterCell = memo(function LetterCell(p: LetterProps) {
  const { s, theme } = p;
  let bg = theme.cell;
  if (p.confirmedColor) bg = alpha(p.confirmedColor, theme.dark ? 0.2 : 0.13);
  if (p.partnerWordColor && !p.confirmedColor) bg = alpha(p.partnerWordColor, 0.1);
  if (p.inWord) bg = theme.activeWord;
  if (p.selected) bg = theme.active;
  if (p.flash) bg = alpha('#D0342C', 0.35);
  const color = p.confirmedColor ? (p.hinted ? theme.inkFaint : p.confirmedColor) : theme.ink;
  return (
    <Pressable
      onPress={() => p.onPress(p.k)}
      accessibilityLabel={p.letter ? `Casilla con ${p.letter}` : 'Casilla vacía'}
      style={{ width: s, height: s, backgroundColor: bg, borderRightWidth: 1, borderBottomWidth: 1, borderColor: theme.gridLine, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: s * 0.52, color, includeFontPadding: false }}>{p.letter}</Text>
      {p.arrows?.map((a) => <Arrow key={a} kind={a} s={s} color={theme.inkSoft} />)}
      {p.partnerColor && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 2.5, borderColor: p.partnerColor, borderRadius: 3 }} />
      )}
    </Pressable>
  );
});

/** Mayor tamaño de letra con el que la definición cabe en su hueco sin partir palabras. */
function fitText(text: string, w: number, h: number, max: number): number {
  const words = text.split(' ');
  const CH = 0.56; // ancho medio de un carácter respecto al tamaño de letra
  for (let size = max; size > 4; size -= 0.25) {
    const perLine = Math.floor(w / (size * CH));
    if (words.some((x) => x.length > perLine)) continue;
    let lines = 1;
    let cur = 0;
    for (const x of words) {
      if (cur === 0) cur = x.length;
      else if (cur + 1 + x.length <= perLine) cur += 1 + x.length;
      else {
        lines++;
        cur = x.length;
      }
    }
    if (lines * size * 1.12 <= h) return size;
  }
  return 4;
}

interface ClueProps {
  k: string;
  s: number;
  theme: Theme;
  clues: { id: number; text: string; active: boolean; done: boolean }[];
  onPress: (wordId: number) => void;
}

const ClueCell = memo(function ClueCell({ s, theme, clues, onPress }: ClueProps) {
  const two = clues.length > 1;
  return (
    <View style={{ width: s, height: s, backgroundColor: theme.clueCell, borderRightWidth: 1, borderBottomWidth: 1, borderColor: theme.gridLine }}>
      {clues.map((c, i) => {
        const size = fitText(c.text, s - 3, (two ? s / 2 : s) - 2, s * (two ? 0.17 : 0.2));
        return (
          <Pressable
            key={c.id}
            onPress={() => onPress(c.id)}
            accessibilityLabel={`Definición: ${c.text}`}
            style={{
              flex: 1,
              paddingHorizontal: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.active ? theme.active : 'transparent',
              borderTopWidth: i > 0 ? 1 : 0,
              borderColor: theme.gridLine,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: size,
                lineHeight: size * 1.12,
                textAlign: 'center',
                color: theme.clueText,
                opacity: c.done ? 0.4 : 1,
                includeFontPadding: false,
              }}
            >
              {c.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export interface GridProps {
  puzzle: Puzzle;
  cells: Cells;
  derived: Derived;
  colors: Record<string, string>; // uid -> hex
  theme: Theme;
  size: number;
  selected: string | null;
  activeWord: number | null;
  partner: { k: string; word: Set<string>; color: string } | null;
  flash: Set<string>;
  onPressCell: (k: string) => void;
  onPressClue: (wordId: number) => void;
}

export function Grid(p: GridProps) {
  const { puzzle, theme, size: s } = p;
  const activeCells = new Set(p.activeWord !== null ? puzzle.words[p.activeWord].cells : []);
  const rows = [];
  for (let r = 0; r < puzzle.h; r++) {
    const row = [];
    for (let c = 0; c < puzzle.w; c++) {
      const k = key(r, c);
      if (puzzle.solution[k] === undefined) {
        const ids = puzzle.cluesAt[k] ?? [];
        row.push(
          <ClueCell
            key={k}
            k={k}
            s={s}
            theme={theme}
            clues={ids.map((id) => ({ id, text: puzzle.words[id].clue, active: id === p.activeWord, done: p.derived.doneWords.has(id) }))}
            onPress={p.onPressClue}
          />,
        );
      } else {
        const e = p.cells[k];
        const conf = p.derived.confirmed.has(k) && e;
        row.push(
          <LetterCell
            key={k}
            k={k}
            s={s}
            theme={theme}
            letter={e?.l ?? ''}
            arrows={puzzle.arrowsAt[k]}
            selected={p.selected === k}
            inWord={activeCells.has(k)}
            confirmedColor={conf ? (p.colors[e.by] ?? theme.inkSoft) : null}
            hinted={!!e?.h}
            partnerColor={p.partner?.k === k ? p.partner.color : null}
            partnerWordColor={p.partner?.word.has(k) ? p.partner.color : null}
            flash={p.flash.has(k)}
            onPress={p.onPressCell}
          />,
        );
      }
    }
    rows.push(
      <View key={r} style={{ flexDirection: 'row' }}>
        {row}
      </View>,
    );
  }
  return (
    <View style={{ borderLeftWidth: 1, borderTopWidth: 1, borderColor: theme.gridLine, borderRadius: 6, overflow: 'hidden', alignSelf: 'center' }}>
      {rows}
    </View>
  );
}
