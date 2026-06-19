import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/Icon';
import { ActionSheet } from '../components/ActionSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptDetail'>;

function isSafeImg(uri?: string): boolean {
  return !!uri && /^(https?|file):/i.test(uri);
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function ReceiptDetailScreen({ navigation, route }: Props) {
  const c = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { getReceipt, removeReceipt, showToast } = useApp();
  const receipt = getReceipt(route.params.id);
  const [zoom, setZoom] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!receipt) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.missing}>Receipt not found</Text>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const hasPhoto = isSafeImg(receipt.imageUrl);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* Photo */}
        {hasPhoto ? (
          <Pressable onPress={() => setZoom(true)} style={[styles.photoWrap, { paddingTop: insets.top }]}>
            <Image source={{ uri: receipt.imageUrl }} style={styles.photo} resizeMode="cover" />
            <View style={styles.zoomHint}>
              <Icon name="search" size={14} color="#fff" />
              <Text style={styles.zoomHintText}>Tap to zoom</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.noPhoto, { paddingTop: insets.top + 40 }]}>
            <Icon name="receipt" size={44} color={c.gray} />
            <Text style={styles.noPhotoText}>No photo attached</Text>
          </View>
        )}

        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        {/* Details */}
        <View style={styles.body}>
          <Text style={styles.merchant}>{receipt.merchant}</Text>
          <Text style={styles.date}>{fmtDate(receipt.date)}</Text>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{receipt.currency} {fmtMoney(receipt.total)}</Text>
            <View style={styles.totalSubRow}>
              <Text style={styles.totalSub}>Subtotal {receipt.currency} {fmtMoney(receipt.subtotal)}</Text>
              <Text style={styles.totalSub}>Tax {receipt.currency} {fmtMoney(receipt.tax)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{receipt.category}</Text>
            </View>
            {!!receipt.paymentMethod && (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Payment</Text>
                <Text style={styles.metaValue}>{receipt.paymentMethod}</Text>
              </View>
            )}
          </View>

          {receipt.tags?.length ? (
            <View style={styles.tagWrap}>
              {receipt.tags.map((t) => (
                <View key={t} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {receipt.items?.length ? (
            <>
              <Text style={styles.sectionTitle}>Items</Text>
              <View style={styles.itemsCard}>
                {receipt.items.map((it, i) => (
                  <View key={i} style={[styles.itemRow, i === receipt.items.length - 1 && styles.itemRowLast]}>
                    <Text style={styles.itemName}>{it.n}</Text>
                    <Text style={styles.itemPrice}>{fmtMoney(it.p)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Pressable style={styles.deleteBtn} onPress={() => setDeleteOpen(true)}>
            <Text style={styles.deleteText}>Delete receipt</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Fullscreen zoomable photo */}
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <View style={styles.zoomRoot}>
          <ScrollView
            style={styles.zoomScroll}
            contentContainerStyle={styles.zoomContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {hasPhoto && <Image source={{ uri: receipt.imageUrl }} style={styles.zoomImage} resizeMode="contain" />}
          </ScrollView>
          <Pressable style={[styles.zoomClose, { top: insets.top + 8 }]} onPress={() => setZoom(false)}>
            <Text style={styles.zoomCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>

      <ActionSheet
        visible={deleteOpen}
        title="Delete receipt"
        message="Remove this receipt from your records?"
        options={[
          {
            label: 'Delete',
            destructive: true,
            onPress: () => {
              removeReceipt(receipt.id);
              showToast('Receipt deleted');
              navigation.goBack();
            },
          },
        ]}
        onClose={() => setDeleteOpen(false)}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
    missing: { fontSize: 16, fontWeight: '600', color: c.grayMid },
    photoWrap: { width: '100%', backgroundColor: c.surfaceAlt },
    photo: { width: '100%', height: 320 },
    zoomHint: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    zoomHintText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    noPhoto: { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: c.surfaceAlt },
    noPhotoText: { fontSize: 14, fontWeight: '600', color: c.grayMid },
    backBtn: {
      position: 'absolute',
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { fontSize: 28, color: '#241B12', marginTop: -3 },
    body: { paddingHorizontal: 20, paddingTop: 20 },
    merchant: { fontFamily: fonts.display, fontSize: 26, color: c.ink, letterSpacing: -0.5 },
    date: { fontSize: 14, fontWeight: '500', color: c.grayMid, marginTop: 4, marginBottom: 18 },
    totalCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
    },
    totalLabel: { fontSize: 12, fontWeight: '700', color: c.grayMid, letterSpacing: 0.5, marginBottom: 4 },
    totalValue: { fontFamily: fonts.displayExtra, fontSize: 34, color: c.ink, letterSpacing: -0.8 },
    totalSubRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    totalSub: { fontSize: 13, fontWeight: '600', color: c.grayMid },
    metaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    metaCell: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 14,
    },
    metaLabel: { fontSize: 11, fontWeight: '700', color: c.grayMid, letterSpacing: 0.3, marginBottom: 3 },
    metaValue: { fontSize: 15, fontWeight: '700', color: c.ink },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    tagChip: { backgroundColor: c.accentSoft, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999 },
    tagText: { fontSize: 13, fontWeight: '700', color: c.accent },
    sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: c.ink, marginBottom: 8, marginTop: 4 },
    itemsCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      marginBottom: 18,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    itemRowLast: { borderBottomWidth: 0 },
    itemName: { fontSize: 14, fontWeight: '500', color: c.ink, flex: 1 },
    itemPrice: { fontSize: 14, fontWeight: '700', color: c.ink },
    deleteBtn: {
      borderWidth: 1.5,
      borderColor: 'rgba(220,38,38,0.5)',
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 6,
    },
    deleteText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
    closeBtn: { backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
    closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    zoomRoot: { flex: 1, backgroundColor: '#000' },
    zoomScroll: { flex: 1 },
    zoomContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    zoomImage: { width: '100%', height: '100%' },
    zoomClose: {
      position: 'absolute',
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  });
