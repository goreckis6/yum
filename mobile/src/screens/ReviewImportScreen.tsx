import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { uploadImageIfLocal } from '../lib/storage';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { Ingredient, TAG_ICON } from '../types';
import { Icon } from '../components/Icon';
import { CoverArt, COVER_PRESETS } from '../components/CoverArt';
import { cleanStep, scaleAmount } from '../utils/scale';
import { RootStackParamList } from '../navigation/types';
import { useI18n } from '../i18n/I18nContext';
import { enrichRecipe } from '../api/recipes';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewImport'>;

export function ReviewImportScreen({ navigation, route }: Props) {
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
  const { addRecipe, showToast } = useApp();
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const isManual = route.params.manual === true;

  const [draft, setDraft] = useState(() => {
    const d = route.params.draft;
    return { ...d, servings: d.servings && d.servings > 0 ? d.servings : 1 };
  });
  const [enriching, setEnriching] = useState(false);
  const [coverMode, setCoverMode] = useState<'photo' | 'text'>(
    route.params.draft.imageUrl ? 'photo' : route.params.draft.cover ? 'text' : 'photo',
  );

  // Scale ingredient amounts when the user changes servings.
  const changeServings = (next: number) => {
    const prev = draft.servings || next || 1;
    const factor = next / prev;
    const ingredients =
      factor === 1 || !isFinite(factor)
        ? draft.ingredients
        : draft.ingredients.map((ing) => ({ ...ing, a: scaleAmount(ing.a, factor) }));
    setDraft({ ...draft, servings: next, ingredients });
  };

  const pickPhoto = async (fromCamera: boolean) => {
    // Camera needs permission; the photo library uses the system picker which
    // works without one, so we only gate the camera.
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });

    if (result.canceled || !result.assets[0]) return;
    setDraft({ ...draft, imageUrl: result.assets[0].uri });
  };

  const onPhotoPress = () => {
    Alert.alert('Recipe photo', 'Choose source', [
      { text: 'Take photo', onPress: () => pickPhoto(true) },
      { text: 'Choose from gallery', onPress: () => pickPhoto(false) },
      ...(draft.imageUrl ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setDraft({ ...draft, imageUrl: undefined }) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
    const ingredients = draft.ingredients.map((ing, i) =>
      i === index ? { ...ing, ...patch } : ing,
    );
    setDraft({ ...draft, ingredients });
  };

  const removeIngredient = (index: number) => {
    setDraft({
      ...draft,
      ingredients: draft.ingredients.filter((_, i) => i !== index),
    });
  };

  const addIngredient = () => {
    setDraft({
      ...draft,
      ingredients: [...draft.ingredients, { a: '', n: t('reviewImport.newIngredient'), aisle: 'Pantry' }],
    });
  };

  const updateStep = (index: number, text: string) => {
    const steps = draft.steps.map((s, i) => (i === index ? text : s));
    setDraft({ ...draft, steps });
  };

  const removeStep = (index: number) => {
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) });
  };

  const enrich = async () => {
    setEnriching(true);
    try {
      const { recipe: enriched } = await enrichRecipe(draft as any);
      setDraft((prev) => ({
        ...prev,
        ingredients: enriched.ingredients ?? prev.ingredients,
        steps: enriched.steps ?? prev.steps,
        kcal: enriched.kcal ?? prev.kcal,
        p: enriched.p ?? prev.p,
        c: enriched.c ?? prev.c,
        f: enriched.f ?? prev.f,
        time: enriched.time ?? prev.time,
        servings: enriched.servings ?? prev.servings,
      }));
      showToast('Przepis uzupełniony przez AI ✓');
    } catch (err: any) {
      showToast(err?.message ?? 'Błąd AI — spróbuj ponownie');
    } finally {
      setEnriching(false);
    }
  };

  const addStep = () => {
    setDraft({ ...draft, steps: [...draft.steps, ''] });
  };

  const save = async () => {
    const uploaded =
      coverMode === 'text' || !userId ? draft.imageUrl : await uploadImageIfLocal(draft.imageUrl, userId);
    const recipe = {
      ...draft,
      id: `imp${Date.now()}`,
      // Text cover wins → drop any photo; photo mode → drop the cover preset.
      imageUrl: coverMode === 'text' ? undefined : uploaded,
      cover: coverMode === 'text' ? draft.cover ?? COVER_PRESETS[0].id : undefined,
    };
    addRecipe(recipe);
    showToast(t('reviewImport.saved'));
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Main' },
        { name: 'RecipeDetail', params: { id: recipe.id } },
      ],
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <Text style={styles.eyebrow}>{isManual ? t('reviewImport.eyebrowManual') : t('reviewImport.eyebrow')}</Text>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{isManual ? t('reviewImport.titleManual') : t('reviewImport.title')}</Text>
        <Pressable
          style={[styles.aiBtn, enriching && styles.aiBtnLoading]}
          onPress={enrich}
          disabled={enriching}
        >
          <Text style={styles.aiStar}>✦</Text>
          <Text style={styles.aiBtnText}>{enriching ? 'Analizuję…' : 'AI Inspired'}</Text>
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, coverMode === 'photo' && styles.modeBtnOn]}
          onPress={() => setCoverMode('photo')}
        >
          <Text style={[styles.modeText, coverMode === 'photo' && styles.modeTextOn]}>{t('reviewImport.photo')}</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, coverMode === 'text' && styles.modeBtnOn]}
          onPress={() => {
            setCoverMode('text');
            if (!draft.cover) setDraft({ ...draft, cover: COVER_PRESETS[0].id });
          }}
        >
          <Text style={[styles.modeText, coverMode === 'text' && styles.modeTextOn]}>{t('reviewImport.textCover')}</Text>
        </Pressable>
      </View>

      {coverMode === 'photo' ? (
        <Pressable style={styles.photoWrap} onPress={onPhotoPress}>
          {draft.imageUrl ? (
            <>
              <Image source={{ uri: draft.imageUrl }} style={styles.photoImg} resizeMode="cover" />
              <View style={styles.photoEditBadge}>
                <Text style={styles.photoEditText}>{t('scanReceipt.changePhoto')}</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Icon name="camera" size={34} color={c.grayMid} />
              <Text style={styles.photoPlaceholderText}>{t('reviewImport.addPhoto')}</Text>
            </View>
          )}
        </Pressable>
      ) : (
        <>
          <View style={styles.photoWrap}>
            <CoverArt cover={draft.cover} title={draft.title || 'Recipe title'} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swatchRow}>
            {COVER_PRESETS.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.swatch, draft.cover === p.id && styles.swatchOn]}
                onPress={() => setDraft({ ...draft, cover: p.id })}
              >
                <View style={[styles.swatchFill, { backgroundColor: p.from }]} />
                <View style={[styles.swatchFill, styles.swatchHalf, { backgroundColor: p.to }]} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>{t('reviewImport.titleField')}</Text>
      <TextInput
        style={styles.field}
        value={draft.title}
        onChangeText={(title) => setDraft({ ...draft, title })}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>{t('reviewImport.servings')}</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => changeServings(Math.max(1, draft.servings - 1))}
              hitSlop={8}
            >
              <Text style={styles.stepSign}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{draft.servings}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => changeServings(draft.servings + 1)}
              hitSlop={8}
            >
              <Text style={styles.stepSign}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>{t('reviewImport.time')}</Text>
          <TextInput
            style={styles.field}
            keyboardType="number-pad"
            value={String(draft.time)}
            onChangeText={(t) => setDraft({ ...draft, time: parseInt(t, 10) || 0 })}
          />
        </View>
      </View>

      <Text style={styles.label}>{t('reviewImport.categories')}</Text>
      <Text style={styles.tagHint}>{t('reviewImport.catHint')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagRow}>
        {(['Quick', 'Dinner', 'Breakfast', 'Lunch', 'Vegetarian', 'High-protein'] as const).map((tag) => {
          const on = draft.tags?.includes(tag);
          return (
            <Pressable
              key={tag}
              style={[styles.tagChip, on && styles.tagChipOn]}
              onPress={() => {
                const tags = on
                  ? (draft.tags ?? []).filter((t) => t !== tag)
                  : [...(draft.tags ?? []), tag];
                setDraft({ ...draft, tags });
              }}
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>
                {TAG_ICON[tag] ? `${TAG_ICON[tag]} ${tag}` : tag}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {(() => {
        // Group the editable ingredients by their section, keeping original
        // indices so edit/remove still target the right item.
        const map = new Map<string, { ing: Ingredient; i: number }[]>();
        draft.ingredients.forEach((ing, i) => {
          const g = ing.group?.trim() || '';
          const arr = map.get(g) ?? [];
          arr.push({ ing, i });
          map.set(g, arr);
        });
        const groups = Array.from(map.entries());
        const has = groups.some(([g]) => g !== '');
        return (
          <>
            <Text style={styles.section}>{has ? groups[0][0] || t('recipe.ingredients') : t('recipe.ingredients')}</Text>
            {groups.map(([g, items], gi) => (
              <View key={g || '__main__'}>
                {has && gi > 0 && <Text style={styles.ingGroupHead}>{g || 'Other'}</Text>}
                {items.map(({ ing, i }) => (
                  <View key={i} style={styles.ingRow}>
                    <TextInput
                      style={styles.ingAmt}
                      value={ing.a}
                      onChangeText={(a) => updateIngredient(i, { a })}
                      placeholder={t('reviewImport.amount')}
                    />
                    <TextInput
                      style={styles.ingName}
                      value={ing.n}
                      onChangeText={(n) => updateIngredient(i, { n })}
                      placeholder={t('reviewImport.ingredient')}
                    />
                    <Pressable onPress={() => removeIngredient(i)}>
                      <Text style={styles.remove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
          </>
        );
      })()}
      <Pressable style={styles.addIng} onPress={addIngredient}>
        <Text style={styles.addIngText}>{t('reviewImport.addIngredient')}</Text>
      </Pressable>

      <Text style={styles.section}>{t('reviewImport.steps')}</Text>
      {draft.steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <TextInput
            style={styles.stepInput}
            value={cleanStep(step)}
            onChangeText={(text) => updateStep(i, text)}
            placeholder={t('reviewImport.stepPlaceholder')}
            placeholderTextColor={c.gray}
            multiline
          />
          <Pressable onPress={() => removeStep(i)} hitSlop={8}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addIng} onPress={addStep}>
        <Text style={styles.addIngText}>{t('reviewImport.addStep')}</Text>
      </Pressable>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>{t('reviewImport.saveLibrary')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  backIcon: { fontSize: 28, color: c.ink },
  eyebrow: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.ink, flex: 1 },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 10,
  },
  aiBtnLoading: { opacity: 0.6 },
  aiStar: { color: '#a78bfa', fontSize: 13 },
  aiBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 6 },
  field: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    fontWeight: '500',
    color: c.ink,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 6,
    height: 48,
    marginBottom: 14,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontSize: 22, fontWeight: '700', color: c.ink, marginTop: -2 },
  stepValue: { fontSize: 16, fontWeight: '700', color: c.ink },
  section: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: c.ink,
    marginTop: 8,
    marginBottom: 12,
  },
  ingGroupHead: { fontFamily: fonts.display, fontSize: 17, color: c.ink, marginTop: 14, marginBottom: 10 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ingAmt: {
    width: 72,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  ingName: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },
  remove: { color: c.gray, fontSize: 16, padding: 8 },
  addIng: { marginBottom: 16 },
  addIngText: { fontSize: 14, fontWeight: '700', color: c.ink },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EBEBEB',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    color: c.ink,
    flexShrink: 0,
    marginTop: 10,
  },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#3A3A3A' },
  stepInput: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: c.ink,
    lineHeight: 20,
    minHeight: 44,
  },
  tagHint: { fontSize: 11, fontWeight: '600', color: c.grayMid, marginBottom: 10, marginTop: -4 },
  tagRow: { marginBottom: 18 },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tagChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  tagText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
  tagTextOn: { color: '#fff' },
  saveBtn: {
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeBtnOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  modeText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
  modeTextOn: { color: c.ink },
  swatchRow: { marginBottom: 16 },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 12,
    marginRight: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: c.accent },
  swatchFill: { flex: 1 },
  swatchHalf: {},
  photoWrap: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: c.surface,
  },
  photoImg: { width: '100%', height: '100%' },
  photoEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  photoEditText: { fontSize: 12, fontWeight: '700', color: c.ink },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderIcon: { fontSize: 32 },
  photoPlaceholderText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
});
