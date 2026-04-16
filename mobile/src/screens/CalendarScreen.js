import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing } from '../theme';
import {
  getTodayBs, getBsMonthDays, getBsDayOfWeek, bsToAd, toNepaliNumeral,
  BS_MONTHS, BS_MONTHS_NP, WEEKDAYS_SHORT_NP,
} from '../bs-date';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 32) / 7);

export default function CalendarScreen() {
  const todayBs = getTodayBs();
  const [year, setYear] = useState(todayBs.year);
  const [month, setMonth] = useState(todayBs.month);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const loadHolidays = async () => {
    try {
      const data = await api.getHolidays(year);
      setHolidays(data);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadHolidays();
    }, [year])
  );

  // Build holiday lookup for current month
  const holidayMap = {};
  holidays.forEach(h => {
    if (h.bs_month === month) {
      const startDay = h.bs_day;
      const endDay = (h.bs_month_end === month || !h.bs_month_end) ? (h.bs_day_end || h.bs_day) : getBsMonthDays(year, month);
      for (let d = startDay; d <= endDay; d++) {
        holidayMap[d] = h;
      }
    }
    // Handle holidays that span from previous month into current
    if (h.bs_month_end === month && h.bs_month !== month) {
      for (let d = 1; d <= (h.bs_day_end || 1); d++) {
        holidayMap[d] = h;
      }
    }
  });

  const daysInMonth = getBsMonthDays(year, month);
  const startDow = getBsDayOfWeek(year, month, 1);

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === todayBs.day && month === todayBs.month && year === todayBs.year;
  const isSaturday = (d) => {
    if (!d) return false;
    const idx = cells.indexOf(d);
    return idx % 7 === 6;
  };

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    setSelectedDay(null);
    setYear(todayBs.year);
    setMonth(todayBs.month);
  };

  // Get AD date for display
  const firstAd = bsToAd(year, month, 1);
  const lastAd = bsToAd(year, month, daysInMonth);
  const adRange = `${firstAd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}${
    firstAd.getMonth() !== lastAd.getMonth() ? ' – ' + lastAd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
  }`;

  // Selected day info
  const selectedHoliday = selectedDay ? holidayMap[selectedDay] : null;
  const selectedAdDate = selectedDay ? bsToAd(year, month, selectedDay) : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Month navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={styles.monthInfo}>
          <Text style={styles.monthNp}>{BS_MONTHS_NP[month - 1]}</Text>
          <Text style={styles.monthEn}>{BS_MONTHS[month - 1]} {year}</Text>
          <Text style={styles.adRange}>{adRange}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS_SHORT_NP.map((d, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={[styles.weekText, i === 6 && styles.satText]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`e-${idx}`} style={styles.cell} />;
              }
              const holiday = holidayMap[day];
              const today = isToday(day);
              const sat = isSaturday(day);
              const isSelected = selectedDay === day;

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.cell,
                    today && styles.todayCell,
                    isSelected && styles.selectedCell,
                  ]}
                  onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayNp,
                    today && styles.todayText,
                    sat && styles.satText,
                    holiday && styles.holidayText,
                    isSelected && styles.selectedText,
                  ]}>
                    {toNepaliNumeral(day)}
                  </Text>
                  <Text style={[
                    styles.dayEn,
                    today && styles.todayTextSm,
                    sat && { color: '#ef4444' },
                    holiday && { color: '#ef4444' },
                    isSelected && styles.selectedTextSm,
                  ]}>
                    {day}
                  </Text>
                  {holiday && (
                    <View style={[styles.dot, holiday.women_only ? styles.dotPurple : styles.dotRed]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day info */}
          {selectedDay && (
            <View style={styles.infoCard}>
              <Text style={styles.infoDate}>
                {toNepaliNumeral(year)}/{toNepaliNumeral(String(month).padStart(2, '0'))}/{toNepaliNumeral(String(selectedDay).padStart(2, '0'))}
              </Text>
              <Text style={styles.infoAdDate}>
                {selectedAdDate?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              {selectedHoliday ? (
                <View style={[styles.holidayBadge, selectedHoliday.women_only && styles.holidayBadgePurple]}>
                  <Ionicons name="flag" size={14} color="#fff" />
                  <Text style={styles.holidayBadgeText}>
                    {selectedHoliday.name}{selectedHoliday.name_np ? ` (${selectedHoliday.name_np})` : ''}
                  </Text>
                </View>
              ) : (
                <Text style={styles.infoNormal}>Regular working day</Text>
              )}
            </View>
          )}

          {/* Holidays this month */}
          {holidays.filter(h => h.bs_month === month).length > 0 && (
            <View style={styles.holidayList}>
              <Text style={styles.holidayListTitle}>Holidays this month</Text>
              {holidays.filter(h => h.bs_month === month).map(h => (
                <View key={h.id} style={styles.holidayItem}>
                  <View style={[styles.holidayDot, h.women_only && { backgroundColor: '#7c3aed' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayName}>{h.name}</Text>
                    {h.name_np ? <Text style={styles.holidayNameNp}>{h.name_np}</Text> : null}
                    <Text style={styles.holidayDate}>
                      {BS_MONTHS_NP[month - 1]} {toNepaliNumeral(h.bs_day)}
                      {h.bs_day_end ? ` - ${toNepaliNumeral(h.bs_day_end)}` : ''}
                      {h.ad_date ? `  •  ${h.ad_date}` : ''}
                    </Text>
                  </View>
                  {h.women_only ? (
                    <View style={styles.womenBadge}>
                      <Text style={styles.womenBadgeText}>Women</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Holiday</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#7c3aed' }]} />
              <Text style={styles.legendText}>Women Only</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendText, { color: '#ef4444', fontWeight: '600' }]}>शनि</Text>
              <Text style={styles.legendText}>Saturday</Text>
            </View>
          </View>
        </>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthInfo: {
    alignItems: 'center',
    flex: 1,
  },
  monthNp: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  monthEn: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adRange: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  satText: {
    color: '#ef4444',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  todayCell: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectedCell: {
    backgroundColor: colors.primary,
  },
  dayNp: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  dayEn: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: -1,
  },
  todayText: {
    color: colors.primary,
    fontWeight: '800',
  },
  todayTextSm: {
    color: colors.primary,
  },
  selectedText: {
    color: '#fff',
    fontWeight: '800',
  },
  selectedTextSm: {
    color: 'rgba(255,255,255,0.8)',
  },
  holidayText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  dotPurple: {
    backgroundColor: '#7c3aed',
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoDate: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  infoAdDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoNormal: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 8,
  },
  holidayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  holidayBadgePurple: {
    backgroundColor: '#7c3aed',
  },
  holidayBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  holidayList: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  holidayListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  holidayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  holidayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginTop: 5,
  },
  holidayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  holidayNameNp: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  holidayDate: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  womenBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  womenBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7c3aed',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
