import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

const CATEGORY_ICONS = {
  LEAVE: 'calendar-outline',
  SALARY: 'cash-outline',
  PRIVACY: 'lock-closed-outline',
  CODE_OF_CONDUCT: 'shield-checkmark-outline',
  HR: 'people-outline',
  GENERAL: 'document-text-outline',
  CUSTOM: 'reader-outline',
};

const CATEGORY_COLORS = {
  LEAVE: '#059669',
  SALARY: '#d97706',
  PRIVACY: '#7c3aed',
  CODE_OF_CONDUCT: '#1e40af',
  HR: '#dc2626',
  GENERAL: '#475569',
  CUSTOM: '#0d9488',
};

export default function PoliciesScreen() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const loadPolicies = async () => {
    try {
      const data = await api.getPolicies();
      setPolicies(data.policies || []);
    } catch (err) {
      console.error('Failed to load policies:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPolicies();
    }, [])
  );

  const categories = [...new Set(policies.map(p => p.category))];
  const filteredPolicies = selectedCategory
    ? policies.filter(p => p.category === selectedCategory)
    : policies;

  if (selectedPolicy) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setSelectedPolicy(null)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back to Policies</Text>
        </TouchableOpacity>

        <View style={styles.policyDetail}>
          <View style={styles.policyDetailHeader}>
            <View style={[styles.categoryIcon, { backgroundColor: (CATEGORY_COLORS[selectedPolicy.category] || colors.primary) + '14' }]}>
              <Ionicons
                name={CATEGORY_ICONS[selectedPolicy.category] || 'document-text-outline'}
                size={24}
                color={CATEGORY_COLORS[selectedPolicy.category] || colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.policyDetailTitle}>{selectedPolicy.title}</Text>
              <Text style={styles.policyDetailMeta}>
                {selectedPolicy.category.replace(/_/g, ' ')}
                {selectedPolicy.creator && ` · by ${selectedPolicy.creator.name}`}
              </Text>
            </View>
          </View>
          <View style={styles.policyBody}>
            <Text style={styles.policyBodyText}>{selectedPolicy.content}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category filter */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
                {cat.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filteredPolicies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPolicies(); }} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.policyCard}
            onPress={() => setSelectedPolicy(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.cardIcon, { backgroundColor: (CATEGORY_COLORS[item.category] || colors.primary) + '14' }]}>
              <Ionicons
                name={CATEGORY_ICONS[item.category] || 'document-text-outline'}
                size={20}
                color={CATEGORY_COLORS[item.category] || colors.primary}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCategory}>{item.category.replace(/_/g, ' ')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No policies published yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg },
  detailContent: { padding: spacing.lg, paddingBottom: spacing.xxxxl },

  // Filter
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'capitalize' },
  filterTextActive: { color: colors.white },

  // Card
  policyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardCategory: { fontSize: 11, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },

  // Detail view
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: spacing.lg,
  },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  policyDetail: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: 'hidden', ...shadows.sm,
  },
  policyDetailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  categoryIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  policyDetailTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  policyDetailMeta: { fontSize: 12, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  policyBody: { padding: spacing.lg },
  policyBodyText: { fontSize: 15, lineHeight: 24, color: colors.text },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxxxl },
  emptyText: { fontSize: 14, color: colors.textTertiary, marginTop: spacing.md },
});
