import React, { useState } from 'react';
import {
  Image,
  Linking,
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
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { DayKey, MealSlot, RECIPE_TAGS, TAG_ICON } from '../types';
import { RootStackParamList } from '../navigation/types';
import { cleanStep, isToTaste, scaleAmount } from '../utils/scale';
import { convertAmount } from '../utils/amounts';
import { UnitSystem } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { CoverArt } from '../components/CoverArt';
import { ActionSheet, PromptModal, SheetOption } from '../components/ActionSheet';
import { GrocerySheet } from '../components/GrocerySheet';
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
  const c = useTheme();
  const { t } = useI18n();
  const styles = makeStyles(c);
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
    unitSystem,
  } = useApp();

  const [localUnit, setLocalUnit] = React.useState<UnitSystem>(unitSystem);
  React.useEffect(() => { setLocalUnit(unitSystem); }, [unitSystem]);

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickDay, setPickDay] = useState<DayKey>('Wed');
  const [pickSlot, setPickSlot] = useState<MealSlot>('Dinner');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [grocerySheetOpen, setGrocerySheetOpen] = useState(false);

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
  // Group ingredients by their sub-section label ("Marinade", "For the sauce"…),
  // keeping the main (unlabelled) list first.
  const ingredientGroups = (() => {
    const map = new Map<string, { ing: typeof recipe.ingredients[number]; i: number }[]>();
    orderedIngredients.forEach((entry) => {
      const g = entry.ing.group?.trim() || '';
      const arr = map.get(g) ?? [];
      arr.push(entry);
      map.set(g, arr);
    });
    return Array.from(map.entries()); // keep the recipe's own section order
  })();
  const hasGroups = ingredientGroups.some(([g]) => g !== '');
  // Difficulty derived from total time, and a 0–100 fill for each macro bar
  // (relative to a sensible per-serving reference so the bars look balanced).
  const level = t(recipe.time <= 25 ? 'recipe.levelEasy' : recipe.time <= 45 ? 'recipe.levelMedium' : 'recipe.levelInvolved');
  const pct = (grams: number, ref: number) => Math.max(6, Math.min(100, Math.round((grams / ref) * 100)));
  // Stored nutrition is per serving → scale the displayed totals with the
  // chosen number of servings (the bars stay per-serving proportions).
  const nv = (v: number) => Math.round(v * servings);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: recipe.tint }]}>
          {recipe.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={styles.heroPhoto} resizeMode="cover" />
          ) : recipe.cover ? (
            <CoverArt cover={recipe.cover} title={recipe.title} fontSize={30} />
          ) : null}
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditRecipe', { id: recipe.id })}
          >
            <Text style={styles.editText}>{t('recipe.edit')}</Text>
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <Pressable
            style={styles.sourcePill}
            onPress={() => recipe.sourceUrl && Linking.openURL(recipe.sourceUrl)}
            disabled={!recipe.sourceUrl}
            hitSlop={6}
          >
            <Text style={styles.sourceHandle}>{recipe.handle}</Text>
            <Text style={styles.sourceApp}> on {recipe.app}</Text>
            {recipe.sourceUrl ? (
              <View style={{ marginLeft: 7 }}>
                <Icon name="link" size={13} color={c.grayMid} />
              </View>
            ) : null}
          </Pressable>

          <Text style={styles.title}>{recipe.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.rating}>★ {recipe.rating}</Text>
            <Text style={styles.time}>⏱ {recipe.time} min</Text>
            <Pressable
              style={[styles.favBtn, isFav && styles.favBtnOn]}
              onPress={() => { toggleFavorite(recipe.id); showToast(isFav ? 'Removed from favorites' : 'Added to favorites'); }}
            >
              <Icon name="heart" size={17} color={isFav ? '#EF4444' : c.grayMid} fill={isFav} />
            </Pressable>
            <Pressable
              style={[styles.madeBtn, isMade && styles.madeBtnOn]}
              onPress={() => toggleMade(recipe.id)}
            >
              <Text style={[styles.madeText, isMade && styles.madeTextOn]}>
                {isMade ? t('recipe.madeIt') : t('recipe.madeItQ')}
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

          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{recipe.time}′</Text>
              <Text style={styles.statLabel}>{t('recipe.total')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{servings}</Text>
              <Text style={styles.statLabel}>{t('recipe.serves')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{level}</Text>
              <Text style={styles.statLabel}>{t('recipe.level')}</Text>
            </View>
          </View>

          <View style={styles.servingRow}>
            <View>
              <Text style={styles.servingTitle}>{t('recipe.adjustServings')}</Text>
              <Text style={styles.servingSub}>{t('recipe.scalesNote')}</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setServings(Math.max(1, servings - 1))}>
                <Text style={styles.stepSign}>−</Text>
              </Pressable>
              <Text style={styles.servingNum}>{servings}</Text>
              <Pressable style={styles.stepBtnDark} onPress={() => setServings(Math.min(12, servings + 1))}>
                <Text style={styles.stepSignOn}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.nutCard}>
            <View style={styles.nutHeader}>
              <Text style={styles.nutTitle}>
                {t('recipe.nutrition')}{' '}
                <Text style={styles.nutTitleSub}>
                  {servings === 1 ? t('recipe.servingsTotal') : t('recipe.servingsN', { n: servings })}
                </Text>
              </Text>
              <Text style={styles.nutKcal}>{nv(recipe.kcal)} kcal</Text>
            </View>
            <View style={styles.macroCols}>
              <View style={styles.macroCol}>
                <View style={[styles.macroTrack, { backgroundColor: c.sageSoft }]}>
                  <View style={[styles.macroFill, { width: `${pct(recipe.p, 50)}%`, backgroundColor: c.sage }]} />
                </View>
                <Text style={styles.macroLabel}>
                  <Text style={styles.macroValue}>{nv(recipe.p)}g</Text> {t('recipe.protein')}
                </Text>
              </View>
              <View style={styles.macroCol}>
                <View style={[styles.macroTrack, { backgroundColor: c.accentSoft }]}>
                  <View style={[styles.macroFill, { width: `${pct(recipe.c, 75)}%`, backgroundColor: c.gold }]} />
                </View>
                <Text style={styles.macroLabel}>
                  <Text style={styles.macroValue}>{nv(recipe.c)}g</Text> {t('recipe.carbs')}
                </Text>
              </View>
              <View style={styles.macroCol}>
                <View style={[styles.macroTrack, { backgroundColor: c.accentSoft }]}>
                  <View style={[styles.macroFill, { width: `${pct(recipe.f, 40)}%`, backgroundColor: c.accent }]} />
                </View>
                <Text style={styles.macroLabel}>
                  <Text style={styles.macroValue}>{nv(recipe.f)}g</Text> {t('recipe.fat')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.unitToggleRow}>
            <Pressable
              style={[styles.unitTab, localUnit === 'metric' && styles.unitTabOn]}
              onPress={() => setLocalUnit('metric')}
            >
              <Text style={[styles.unitTabText, localUnit === 'metric' && styles.unitTabTextOn]}>Metric</Text>
            </Pressable>
            <Pressable
              style={[styles.unitTab, localUnit === 'imperial' && styles.unitTabOn]}
              onPress={() => setLocalUnit('imperial')}
            >
              <Text style={[styles.unitTabText, localUnit === 'imperial' && styles.unitTabTextOn]}>Imperial</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              {hasGroups ? ingredientGroups[0][0] || t('recipe.ingredients') : t('recipe.ingredients')}
            </Text>
            <Pressable onPress={() => addRecipeToGrocery(recipe.id)}>
              <Text style={styles.sectionAction}>{t('recipe.addAllToGrocery')}</Text>
            </Pressable>
          </View>
          <View style={styles.ingList}>
            {ingredientGroups.map(([group, items], gi) => (
              <View key={group || '__main__'}>
                {hasGroups && gi > 0 && <Text style={styles.ingGroupHead}>{group || 'Other'}</Text>}
                {items.map(({ ing, i }) => {
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
                      <Text style={[styles.ingName, checked && styles.ingChecked]}>{ing.n}</Text>
                      <Text style={[styles.ingAmt, checked && styles.ingChecked]}>{convertAmount(scaleAmount(ing.a, factor), localUnit)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Pressable style={styles.addGroceriesBtn} onPress={() => setGrocerySheetOpen(true)}>
            <Icon name="cart" size={18} color="#fff" />
            <Text style={styles.addGroceriesText}>{t('recipe.addToGroceries')}</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>{t('recipe.method')}</Text>
          <View style={styles.methodList}>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{cleanStep(step)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.actionPrimary} onPress={() => setPickerOpen(true)}>
          <Icon name="calendar" size={17} color="#fff" />
          <Text style={styles.actionPrimaryText}>{t('recipe.mealPlan')}</Text>
        </Pressable>
        <Pressable style={styles.actionIcon} onPress={() => setAddOpen(true)}>
          <Icon name="grid" size={17} color={c.ink} />
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
          assignMeal(pickDay, pickSlot, { type: 'recipe', recipeId: recipe.id });
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

      <GrocerySheet
        visible={grocerySheetOpen}
        onClose={() => setGrocerySheetOpen(false)}
        recipe={recipe}
      />
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
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
    backgroundColor: c.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 28, color: '#fff', marginTop: -4 },
  editBtn: {
    position: 'absolute',
    top: 58,
    right: 18,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: c.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { fontSize: 14, fontWeight: '700', color: '#fff' },
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
    backgroundColor: c.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 16,
  },
  sourceHandle: { fontSize: 13, fontWeight: '600', color: c.ink },
  sourceApp: { fontSize: 13, fontWeight: '500', color: c.grayMid },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 31,
    color: c.ink,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' },
  rating: { fontSize: 13.5, fontWeight: '700', color: c.ink },
  time: { fontSize: 13.5, fontWeight: '600', color: c.grayLight },
  favBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtnOn: { backgroundColor: c.dangerBg },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 },
  tagChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tagChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  tagText: { fontSize: 12, fontWeight: '700', color: c.grayMid },
  tagTextOn: { color: '#fff' },
  madeBtn: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
  },
  madeBtnOn: { backgroundColor: c.accentSoft },
  madeText: { fontSize: 13, fontWeight: '700', color: c.grayMuted },
  madeTextOn: { color: c.accent },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 18,
  },
  servingTitle: { fontSize: 14, fontWeight: '700', color: c.ink },
  servingSub: { fontSize: 12, fontWeight: '500', color: c.grayMid, marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingNum: { fontFamily: fonts.display, fontSize: 21, fontWeight: '700', color: c.ink, minWidth: 22, textAlign: 'center' },
  stepSign: { fontSize: 20, color: c.ink, marginTop: -2 },
  stepSignOn: { fontSize: 20, color: '#fff', marginTop: -2 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  statNum: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: c.ink },
  statLabel: { fontSize: 11, fontWeight: '600', color: c.grayMid, marginTop: 3 },
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    marginTop: 4,
  },
  unitTab: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10,
  },
  unitTabOn: { backgroundColor: c.accent },
  unitTabText: { fontSize: 13, fontWeight: '700', color: c.grayMid },
  unitTabTextOn: { color: '#fff' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 4,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, color: c.ink, marginTop: 4, marginBottom: 8 },
  sectionAction: { fontSize: 12.5, fontWeight: '600', color: c.accent },
  addGroceriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 4,
    marginBottom: 24,
  },
  addGroceriesText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ingList: { marginBottom: 22 },
  ingGroupHead: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: c.ink,
    marginTop: 18,
    marginBottom: 4,
  },
  methodList: { marginTop: 4 },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ingAmt: { fontSize: 14.5, fontWeight: '700', color: c.ink, flexShrink: 0, textAlign: 'right', paddingLeft: 8 },
  ingName: { fontSize: 14.5, fontWeight: '500', color: c.ink, flex: 1, flexShrink: 1 },
  ingChecked: { color: c.grayMid, textDecorationLine: 'line-through' },
  stepRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: '#fff' },
  stepText: { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 22, color: c.grayLight, paddingTop: 3 },
  nutCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },
  nutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  nutTitle: { fontSize: 13.5, fontWeight: '700', color: c.ink },
  nutTitleSub: { fontWeight: '500', color: c.grayMid },
  nutKcal: { fontSize: 17, fontWeight: '700', color: c.accent },
  macroCols: { flexDirection: 'row', gap: 10 },
  macroCol: { flex: 1 },
  macroTrack: { height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 7 },
  macroFill: { height: '100%', borderRadius: 4 },
  macroLabel: { fontSize: 11, color: c.grayMid },
  macroValue: { color: c.ink, fontWeight: '700' },
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
    backgroundColor: c.bg,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: c.accent,
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
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionSecondaryText: { color: c.ink, fontSize: 12.5, fontWeight: '700' },
  actionIcon: {
    width: 48,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionDelete: {
    width: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(220,38,38,0.45)',
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionDeleteText: { fontSize: 16 },
});
