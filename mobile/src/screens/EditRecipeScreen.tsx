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
import { Ingredient } from '../types';
import { Icon } from '../components/Icon';
import { CoverArt, COVER_PRESETS } from '../components/CoverArt';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditRecipe'>;

export function EditRecipeScreen({ navigation, route }: Props) {
  const c = useTheme();
  const styles = makeStyles(c);
  const { getRecipe, updateRecipe, showToast } = useApp();
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const existing = getRecipe(route.params.id);
  const [draft, setDraft] = useState(existing);
  const [coverMode, setCoverMode] = useState<'photo' | 'text'>(
    existing?.imageUrl ? 'photo' : existing?.cover ? 'text' : 'photo',
  );

  if (!draft) {
    return (
      <View style={styles.center}>
        <Text>Recipe not found</Text>
      </View>
    );
  }

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
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
    setDraft({ ...draft, ingredients: draft.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)) });
  };
  const removeIngredient = (index: number) => {
    setDraft({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) });
  };
  const addIngredient = () => {
    setDraft({ ...draft, ingredients: [...draft.ingredients, { a: '', n: 'New ingredient', aisle: 'Pantry' }] });
  };

  const updateStep = (index: number, text: string) => {
    setDraft({ ...draft, steps: draft.steps.map((s, i) => (i === index ? text : s)) });
  };
  const removeStep = (index: number) => {
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) });
  };
  const addStep = () => {
    setDraft({ ...draft, steps: [...draft.steps, ''] });
  };

  const save = async () => {
    const uploaded =
      coverMode === 'text' || !userId ? draft.imageUrl : await uploadImageIfLocal(draft.imageUrl, userId);
    const cleaned = {
      ...draft,
      imageUrl: coverMode === 'text' ? undefined : uploaded,
      cover: coverMode === 'text' ? draft.cover ?? COVER_PRESETS[0].id : undefined,
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
    };
    updateRecipe(cleaned);
    showToast('Recipe updated');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Pressable style={styles.saveTop} onPress={save}>
          <Text style={styles.saveTopText}>Save</Text>
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>Edit recipe</Text>
      <Text style={styles.title}>{draft.title || 'Recipe'}</Text>

      <View style={styles.modeRow}>
        <Pressable style={[styles.modeBtn, coverMode === 'photo' && styles.modeBtnOn]} onPress={() => setCoverMode('photo')}>
          <Text style={[styles.modeText, coverMode === 'photo' && styles.modeTextOn]}>Photo</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, coverMode === 'text' && styles.modeBtnOn]}
          onPress={() => {
            setCoverMode('text');
            if (!draft.cover) setDraft({ ...draft, cover: COVER_PRESETS[0].id });
          }}
        >
          <Text style={[styles.modeText, coverMode === 'text' && styles.modeTextOn]}>Text cover</Text>
        </Pressable>
      </View>

      {coverMode === 'photo' ? (
        <Pressable style={styles.photoWrap} onPress={onPhotoPress}>
          {draft.imageUrl ? (
            <>
              <Image source={{ uri: draft.imageUrl }} style={styles.photoImg} resizeMode="cover" />
              <View style={styles.photoEditBadge}>
                <Text style={styles.photoEditText}>Change photo</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Icon name="camera" size={34} color={c.grayMid} />
              <Text style={styles.photoPlaceholderText}>Add photo</Text>
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
                <View style={[styles.swatchFill, { backgroundColor: p.to }]} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.field} value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Servings</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => setDraft({ ...draft, servings: Math.max(1, draft.servings - 1) })} hitSlop={8}>
              <Text style={styles.stepSign}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{draft.servings}</Text>
            <Pressable style={styles.stepBtn} onPress={() => setDraft({ ...draft, servings: draft.servings + 1 })} hitSlop={8}>
              <Text style={styles.stepSign}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Time (min)</Text>
          <TextInput
            style={styles.field}
            keyboardType="number-pad"
            value={String(draft.time)}
            onChangeText={(t) => setDraft({ ...draft, time: parseInt(t, 10) || 0 })}
          />
        </View>
      </View>

      <Text style={styles.section}>Ingredients</Text>
      {draft.ingredients.map((ing, i) => (
        <View key={i} style={styles.ingRow}>
          <TextInput style={styles.ingAmt} value={ing.a} onChangeText={(a) => updateIngredient(i, { a })} placeholder="amount" />
          <TextInput style={styles.ingName} value={ing.n} onChangeText={(n) => updateIngredient(i, { n })} placeholder="ingredient" />
          <Pressable onPress={() => removeIngredient(i)}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addIngredient}>
        <Text style={styles.addText}>+ Add ingredient</Text>
      </Pressable>

      <Text style={styles.section}>Steps</Text>
      {draft.steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <TextInput
            style={styles.stepInput}
            value={step}
            onChangeText={(t) => updateStep(i, t)}
            placeholder="Describe this step"
            multiline
          />
          <Pressable onPress={() => removeStep(i)}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addStep}>
        <Text style={styles.addText}>+ Add step</Text>
      </Pressable>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>Save changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 28, color: c.ink },
  saveTop: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: c.accent },
  saveTopText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  eyebrow: { fontSize: 12, fontWeight: '700', color: c.grayMid, marginBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 26, color: c.ink, marginBottom: 18 },
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
  section: { fontFamily: fonts.display, fontSize: 17, color: c.ink, marginTop: 8, marginBottom: 12 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ingAmt: { width: 72, backgroundColor: c.surface, borderRadius: 10, padding: 10, fontSize: 14, fontWeight: '700' },
  ingName: { flex: 1, backgroundColor: c.surface, borderRadius: 10, padding: 10, fontSize: 14 },
  remove: { color: c.gray, fontSize: 16, padding: 8 },
  addBtn: { marginBottom: 16 },
  addText: { fontSize: 14, fontWeight: '700', color: c.ink },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    color: c.ink,
    marginTop: 4,
  },
  stepInput: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
    color: c.grayLight,
    minHeight: 44,
  },
  saveBtn: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modeRow: { flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 4, marginBottom: 12, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  modeBtnOn: { backgroundColor: c.surface },
  modeText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
  modeTextOn: { color: c.ink },
  swatchRow: { marginBottom: 16 },
  swatch: { width: 46, height: 46, borderRadius: 12, marginRight: 10, overflow: 'hidden', flexDirection: 'row', borderWidth: 2.5, borderColor: 'transparent' },
  swatchOn: { borderColor: c.accent },
  swatchFill: { flex: 1 },
  photoWrap: { height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: c.surface },
  photoImg: { width: '100%', height: '100%' },
  photoEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: c.scrim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  photoEditText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
});
