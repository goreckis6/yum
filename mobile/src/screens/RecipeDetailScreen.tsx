import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { MealPickerSheet } from '../components/MealPickerSheet';
import { IngredientIcon } from '../components/IngredientIcon';
import { Icon } from '../components/Icon';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { DayKey, DetailTab, MealSlot, RECIPE_TAGS, TAG_ICON } from '../types';
import { RootStackParamList } from '../navigation/types';
import { isToTaste, scaleAmount } from '../utils/scale';
import { CoverArt } from '../components/CoverArt';
import { ActionSheet, PromptModal, SheetOption } from '../components/ActionSheet';
import Svg, { Path, Line } from 'react-native-svg';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

function TrashIcon({ color = '#DC2626' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function RecipeDetailScreen({ navigation, route }: Props) {
  const {
    getRecipe,
    ingChecked,
    made,
    favorites,
    toggleIngredient,
    toggleMade,
    toggleFavorite,
    updateRecipeTags,
    addRecipeToGrocery,
    assignMeal,
    showToast,
    removeRecipe,
    customCookbooks,
    createCookbook,
    toggleRecipeInCookbook,
  } = useApp();

  const addOptions: SheetOption[] = [
    ...customCookbooks.map((cb) => {
      const wasIn = cb.recipeIds.includes(route.params.id);
      return {
        label: `${wasIn ? '✓ ' : ''}${cb.title}`,
        onPress: () => {
          toggleRecipeInCookbook(cb.id, route.params.id);
          showToast(wasIn ? `Removed from ${cb.title}` : `Added to ${cb.title}`);
        },
      };
    }),
    { label: '+ New cookbook', onPress: () => setPromptOpen(true) },
  ];

  const recipe = getRecipe(route.params.id);
  const [servings, setServings] = useState(recipe?.servings ?? 4);
  const [tab, setTab] = useState<DetailTab>('ingredients');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickDay, setPickDay] = useState<DayKey>('Wed');
  const [pickSlot, setPickSlot] = useState<MealSlot>('Dinner');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const handleDelete = () => {
    removeRecipe(route.params.id);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text>Recipe not found</Text>
      </View>
    );
  }

  const isMade = !!made[recipe.id];
  const isFav = !!favorites[recipe.id];
  const factor = servings / (recipe.servings || servings || 1);
  const orderedIngredients = recipe.ingredients
    .map((ing, i) => ({ ing, i }))
    .sort((a, b) => Number(isToTaste(a.ing.a)) - Number(isToTaste(b.ing.a)));
  const totCal = recipe.kcal * servings;
  const calsP = recipe.p * 4;
  const calsC = recipe.c * 4;
  const calsF = recipe.f * 9;
  const sum = calsP + calsC + calsF || 1;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: recipe.tint }]}>
          {recipe.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={styles.heroPhoto} resizeMode="cover" />
          ) : recipe.cover ? (
            <CoverArt cover={recipe.cover} title={recipe.title} fontSize={30} />
          ) : null}
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditRecipe', { id: recipe.id })}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.sourcePill}>
            <View style={[styles.sourceDot, { backgroundColor: recipe.sourceTint }]} />
            <Text style={styles.sourceHandle}>{recipe.handle}</Text>
            <Text style={styles.sourceApp}> on {recipe.app}</Text>
          </View>

          <Text style={styles.title}>{recipe.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.rating}>★ {recipe.rating}</Text>
            <Text style={styles.time}>⏱ {recipe.time} min</Text>
            <Pressable
              style={[styles.favBtn, isFav && styles.favBtnOn]}
              onPress={() => { toggleFavorite(recipe.id); showToast(isFav ? 'Removed from favorites' : 'Added to favorites'); }}
            >
              <Icon name="heart" size={17} color={isFav ? '#EF4444' : colors.grayMid} fill={isFav} />
            </Pressable>
            <Pressable
              style={[styles.madeBtn, isMade && styles.madeBtnOn]}
              onPress={() => toggleMade(recipe.id)}
            >
              <Text style={[styles.madeText, isMade && styles.madeTextOn]}>
                {isMade ? '✓ Made it' : 'Made it?'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.tagsRow}>
            {RECIPE_TAGS.map((tag) => {
              const on = recipe.tags?.includes(tag);
              return (
                <Pressable
                  key={tag}
                  style={[styles.tagChip, on && styles.tagChipOn]}
                  onPress={() => {
                    const next = on
                      ? (recipe.tags ?? []).filter((t) => t !== tag)
                      : [...(recipe.tags ?? []), tag];
                    updateRecipeTags(recipe.id, next);
                  }}
                >
                  <Text style={[styles.tagText, on && styles.tagTextOn]}>
                    {TAG_ICON[tag] ? `${TAG_ICON[tag]} ${tag}` : tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.servingRow}>
            <View>
              <Text style={styles.servingTitle}>Servings</Text>
              <Text style={styles.servingSub}>Scales nutrition & grocery</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setServings(Math.max(1, servings - 1))}>
                <Text>−</Text>
              </Pressable>
              <Text style={styles.servingNum}>{servings}</Text>
              <Pressable style={styles.stepBtnDark} onPress={() => setServings(Math.min(12, servings + 1))}>
                <Text style={{ color: '#fff' }}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.tabs}>
            {(['ingredients', 'steps', 'nutrition'] as DetailTab[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.tab, tab === t && styles.tabOn]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'ingredients' && (
            <View>
              <Text style={styles.ingHint}>{recipe.ingredients.length} ingredients · Tap to check off</Text>
              {orderedIngredients.map(({ ing, i }) => {
                const key = `${recipe.id}:${i}`;
                const checked = !!ingChecked[key];
                return (
                  <Pressable
                    key={key}
                    style={styles.ingRow}
                    onPress={() => toggleIngredient(recipe.id, i)}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <IngredientIcon name={ing.n} aisle={ing.aisle} size={30} muted={checked} />
                    <Text style={[styles.ingAmt, checked && styles.ingChecked]}>{scaleAmount(ing.a, factor)}</Text>
                    <Text style={[styles.ingName, checked && styles.ingChecked]}>{ing.n}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {tab === 'steps' && (
            <View>
              {recipe.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {tab === 'nutrition' && (
            <View style={styles.nutCard}>
              <View style={styles.nutTop}>
                <View>
                  <Text style={styles.kcalBig}>{recipe.kcal}</Text>
                  <Text style={styles.kcalLabel}>calories per serving</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.kcalTotal}>{totCal.toLocaleString()} kcal</Text>
                  <Text style={styles.kcalWhole}>whole recipe</Text>
                </View>
              </View>
              <View style={styles.macroBar}>
                <View style={[styles.macroSeg, { flex: calsP, backgroundColor: '#2A2A2A' }]} />
                <View style={[styles.macroSeg, { flex: calsC, backgroundColor: '#707070' }]} />
                <View style={[styles.macroSeg, { flex: calsF, backgroundColor: '#B0B0B0' }]} />
              </View>
              <View style={styles.macroLabels}>
                <Text style={styles.macroItem}>P {recipe.p}g ({Math.round((calsP / sum) * 100)}%)</Text>
                <Text style={styles.macroItem}>C {recipe.c}g ({Math.round((calsC / sum) * 100)}%)</Text>
                <Text style={styles.macroItem}>F {recipe.f}g ({Math.round((calsF / sum) * 100)}%)</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.actionPrimary} onPress={() => addRecipeToGrocery(recipe.id)}>
          <Icon name="cart" size={17} color="#fff" />
          <Text style={styles.actionPrimaryText}>Grocery</Text>
        </Pressable>
        <Pressable style={styles.actionSecondary} onPress={() => setPickerOpen(true)}>
          <Icon name="calendar" size={17} color={colors.ink} />
          <Text style={styles.actionSecondaryText}>Meal Plan</Text>
        </Pressable>
        <Pressable style={styles.actionIcon} onPress={() => setAddOpen(true)}>
          <Icon name="grid" size={17} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.actionDelete} onPress={() => setDeleteOpen(true)}>
          <TrashIcon color="#DC2626" />
        </Pressable>
      </View>

      <MealPickerSheet
        visible={pickerOpen}
        recipeTitle={recipe.title}
        selectedDay={pickDay}
        selectedSlot={pickSlot}
        onClose={() => setPickerOpen(false)}
        onSelectDay={setPickDay}
        onSelectSlot={setPickSlot}
        onConfirm={() => {
          assignMeal(pickDay, pickSlot, recipe.id);
          setPickerOpen(false);
          showToast(`Added to ${pickDay}`);
        }}
      />

      <ActionSheet
        visible={addOpen}
        title="Add to cookbook"
        message={customCookbooks.length ? 'Tap a cookbook to add or remove' : 'Create your first cookbook'}
        options={addOptions}
        onClose={() => setAddOpen(false)}
      />

      <ActionSheet
        visible={deleteOpen}
        title="Delete recipe"
        message="Remove this recipe from your library?"
        options={[{ label: 'Delete', destructive: true, onPress: handleDelete }]}
        onClose={() => setDeleteOpen(false)}
      />

      <PromptModal
        visible={promptOpen}
        title="New cookbook"
        placeholder="Cookbook name"
        onCancel={() => setPromptOpen(false)}
        onConfirm={(title) => {
          setPromptOpen(false);
          const cbId = createCookbook(title);
          toggleRecipeInCookbook(cbId, route.params.id);
          showToast(`Added to ${title}`);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 300, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 34, overflow: 'hidden' },
  heroPhoto: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: 'absolute',
    top: 58,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 28, color: colors.ink, marginTop: -4 },
  editBtn: {
    position: 'absolute',
    top: 58,
    right: 18,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  heroLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(0,0,0,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    fontFamily: 'monospace',
  },
  sheet: {
    marginTop: -26,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 13,
    paddingLeft: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  sourceDot: { width: 26, height: 26, borderRadius: 13, marginRight: 9 },
  sourceHandle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  sourceApp: { fontSize: 13, fontWeight: '500', color: colors.grayMid },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 31,
    color: colors.ink,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' },
  rating: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  time: { fontSize: 13.5, fontWeight: '600', color: colors.grayLight },
  favBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtnOn: { backgroundColor: '#FEE2E2' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 },
  tagChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tagChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.grayMid },
  tagTextOn: { color: '#fff' },
  madeBtn: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  madeBtnOn: { backgroundColor: '#EFEFED' },
  madeText: { fontSize: 13, fontWeight: '700', color: colors.grayMuted },
  madeTextOn: { color: '#1A1A1A' },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 13,
    marginBottom: 18,
  },
  servingTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  servingSub: { fontSize: 12, fontWeight: '500', color: colors.grayMid, marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingNum: { fontFamily: fonts.display, fontSize: 21, fontWeight: '700', color: colors.ink, minWidth: 22, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.tabBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabOn: { backgroundColor: colors.surface, shadowColor: '#211C18', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  tabText: { fontSize: 13.5, fontWeight: '700', color: colors.grayMid },
  tabTextOn: { color: colors.ink },
  ingHint: { fontSize: 13, fontWeight: '600', color: colors.grayMid, marginBottom: 10 },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEDEB',
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#D6D6D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ingAmt: { fontSize: 14.5, fontWeight: '700', color: colors.ink, minWidth: 62 },
  ingName: { fontSize: 14.5, fontWeight: '500', color: '#3A3A3A', flex: 1 },
  ingChecked: { color: '#BEBEBE', textDecorationLine: 'line-through' },
  stepRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.ink },
  stepText: { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 22, color: '#3A3A3A', paddingTop: 3 },
  nutCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  nutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  kcalBig: { fontFamily: fonts.displayExtra, fontSize: 40, color: colors.ink, letterSpacing: -1 },
  kcalLabel: { fontSize: 13, fontWeight: '600', color: colors.grayMid, marginTop: 5 },
  kcalTotal: { fontSize: 16, fontWeight: '700', color: colors.ink },
  kcalWhole: { fontSize: 12, fontWeight: '600', color: colors.grayMid },
  macroBar: { flexDirection: 'row', height: 11, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.tabBg, marginBottom: 16 },
  macroSeg: { height: '100%' },
  macroLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  macroItem: { fontSize: 12, fontWeight: '700', color: colors.ink },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 10,
    backgroundColor: 'rgba(246,246,244,0.95)',
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionPrimaryText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  actionSecondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionSecondaryText: { color: colors.ink, fontSize: 12.5, fontWeight: '700' },
  actionIcon: {
    width: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionDelete: {
    width: 48,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionDeleteText: { fontSize: 16 },
});
