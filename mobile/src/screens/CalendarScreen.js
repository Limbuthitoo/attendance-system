import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing, shadows } from '../theme';
import {
  getTodayBs, getBsMonthDays, getBsDayOfWeek, bsToAd, toNepaliNumeral,
  BS_MONTHS, BS_MONTHS_NP, WEEKDAYS_SHORT_NP,
} from '../bs-date';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_W = Math.floor((SCREEN_WIDTH - 32) / 7);
const CELL_H = 62;

export default function CalendarScreen() {
  const todayBs = getTodayBs();
  const [year, setYear] = useState(todayBs.year);
  const [month, setMonth] = useState(todayBs.month);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState('monthly');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getHolidays(year).then(hData => {
        setHolidays(hData.holidays || []);
      }).catch(err => {
        console.error('Failed to load holidays:', err);
      }).finally(() => setLoading(false));
    }, [year])
  );

  // Holiday lookup for current month
  const holidayMap = {};
  holidays.forEach(h => {
    if (h.bs_month === month) {
      const endDay = (h.bs_month_end === month || !h.bs_month_end) ? (h.bs_day_end || h.bs_day) : getBsMonthDays(year, month);
      for (let d = h.bs_day; d <= endDay; d++) holidayMap[d] = h;
    }
    if (h.bs_month_end === month && h.bs_month !== month) {
      for (let d = 1; d <= (h.bs_day_end || 1); d++) holidayMap[d] = h;
    }
  });

  const daysInMonth = getBsMonthDays(year, month);
  const startDow = getBsDayOfWeek(year, month, 1);

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = d => d === todayBs.day && month === todayBs.month && year === todayBs.year;
  const isSaturday = d => {
    if (!d) return false;
    return cells.indexOf(d) % 7 === 6;
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

  const firstAd = bsToAd(year, month, 1);
  const lastAd = bsToAd(year, month, daysInMonth);
  const adRange = firstAd.getMonth() !== lastAd.getMonth()
    ? `${firstAd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastAd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : `${firstAd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  const selectedHoliday = selectedDay ? holidayMap[selectedDay] : null;
  const selectedAdDate = selectedDay ? bsToAd(year, month, selectedDay) : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'monthly' && styles.tabActive]}
          onPress={() => setViewMode('monthly')}
        >
          <Ionicons name="calendar-outline" size={15} color={viewMode === 'monthly' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, viewMode === 'monthly' && styles.tabTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'notice' && styles.tabActive]}
          onPress={() => setViewMode('notice')}
        >
          <Ionicons name="document-text-outline" size={15} color={viewMode === 'notice' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, viewMode === 'notice' && styles.tabTextActive]}>Holiday Notice</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'notice' ? (
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeCompany}>ARCHISYS INNOVATIONS</Text>
            <Text style={styles.noticeSubtitle}>Attendance Management System</Text>
          </View>
          <Text style={styles.noticeTitle}>OFFICIAL NOTICE</Text>
          <Text style={styles.noticeSubject}>
            <Text style={{ fontWeight: '700' }}>Subject: </Text>
            Public Holiday Schedule for {year} B.S.
          </Text>
          <Text style={styles.noticeBody}>
            This is to inform all employees that the following public holidays have been approved for {year} B.S.
            The schedule reflects major national, cultural, and religious observances.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, { width: 32 }]}>S.N.</Text>
                <Text style={[styles.thText, { flex: 1 }]}>Holiday</Text>
                <Text style={[styles.thText, { width: 88 }]}>BS Date</Text>
                <Text style={[styles.thText, { width: 80 }]}>AD Date</Text>
              </View>

              {holidays.map((h, i) => {
                const monthName = BS_MONTHS[h.bs_month - 1] || '';
                const bsDate = h.bs_day_end
                  ? `${monthName} ${h.bs_day}–${h.bs_day_end}`
                  : `${monthName} ${h.bs_day}`;
                const adDate = h.ad_date_end
                  ? `${h.ad_date ? h.ad_date.slice(5) : '—'} – ${h.ad_date_end.slice(5)}`
                  : h.ad_date ? h.ad_date.slice(5) : '—';
                return (
                  <View key={h.id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
                    <Text style={[styles.tdText, { width: 32, textAlign: 'center', color: colors.textTertiary }]}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tdText, { fontWeight: '600' }]}>{h.name}</Text>
                      {h.name_np ? <Text style={styles.tdNp}>{h.name_np}</Text> : null}
                      {h.women_only ? <Text style={styles.womenTag}>Women Only</Text> : null}
                    </View>
                    <Text style={[styles.tdText, { width: 88, textAlign: 'center', fontSize: 11 }]}>{bsDate}</Text>
                    <Text style={[styles.tdText, { width: 80, textAlign: 'center', fontSize: 11 }]}>{adDate}</Text>
                  </View>
                );
              })}

              <View style={styles.noticeNotes}>
                <Text style={styles.noticeNotesTitle}>Notes:</Text>
                {[
                  'Saturdays shall remain weekly holidays.',
                  'Holidays falling on weekends shall not be substituted unless otherwise notified.',
                  'Festival dates are subject to change per official lunar calendar confirmations.',
                  'The management reserves the right to make necessary amendments.',
                ].map((note, i) => (
                  <Text key={i} style={styles.noticeNote}>• {note}</Text>
                ))}
              </View>

              <View style={styles.noticeSignature}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Authorized Signatory</Text>
                <Text style={styles.signatureDept}>Human Resources Department</Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <>
          {/* Month navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={goToToday} style={styles.monthCenter} activeOpacity={0.7}>
              <Text style={styles.monthNp}>{BS_MONTHS_NP[month - 1]}</Text>
              <Text style={styles.monthEn}>{BS_MONTHS[month - 1]} {year}</Text>
              <View style={styles.adRangePill}>
                <Text style={styles.adRangeText}>{adRange}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
          ) : (
            <>
              {/* Calendar card */}
              <View style={styles.calendarCard}>
                {/* Weekday header row */}
                <View style={styles.weekRow}>
                  {WEEKDAYS_SHORT_NP.map((d, i) => (
                    <View key={i} style={[styles.weekCell, i === 6 && styles.weekCellSat]}>
                      <Text style={[styles.weekText, i === 6 && styles.satLabel]}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Grid */}
                <View style={styles.grid}>
                  {cells.map((day, idx) => {
                    if (day === null) return <View key={`e-${idx}`} style={styles.cell} />;

                    const holiday = holidayMap[day];
                    const today = isToday(day);
                    const sat = isSaturday(day);
                    const isSelected = selectedDay === day;

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.cell, isSelected && styles.selectedCell]}
                        onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.dayCircle, today && styles.todayCircle]}>
                          <Text style={[
                            styles.dayNp,
                            today && styles.todayDayNp,
                            isSelected && styles.selectedDayNp,
                            !today && !isSelected && holiday && styles.holidayDayNp,
                            !today && !isSelected && !holiday && sat && styles.satDayNp,
                          ]}>
                            {toNepaliNumeral(day)}
                          </Text>
                        </View>
                        <Text style={[
                          styles.dayEn,
                          today && styles.todayDayEn,
                          isSelected && styles.selectedDayEn,
                          !today && !isSelected && (holiday || sat) && styles.redDayEn,
                        ]}>
                          {day}
                        </Text>
                        <View style={styles.dotRow}>
                          {holiday && (
                            <View style={[styles.dot, holiday.women_only ? styles.dotPurple : styles.dotRed]} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selected day info */}
              {selectedDay && (
                <View style={styles.infoCard}>
                  <View style={styles.infoDateRow}>
                    <View style={styles.infoBsBlock}>
                      <Text style={styles.infoBsLabel}>BS</Text>
                      <Text style={styles.infoBsDate}>
                        {toNepaliNumeral(year)}/{toNepaliNumeral(String(month).padStart(2, '0'))}/{toNepaliNumeral(String(selectedDay).padStart(2, '0'))}
                      </Text>
                      <Text style={styles.infoBsMonthName}>
                        {BS_MONTHS_NP[month - 1]} {toNepaliNumeral(selectedDay)}, {toNepaliNumeral(year)}
                      </Text>
                    </View>
                    <View style={styles.infoSep} />
                    <View style={styles.infoAdBlock}>
                      <Text style={styles.infoAdLabel}>AD</Text>
                      <Text style={styles.infoAdDate}>
                        {selectedAdDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <Text style={styles.infoAdDay}>
                        {selectedAdDate?.toLocaleDateString('en-US', { weekday: 'long' })}
                      </Text>
                    </View>
                  </View>

                  {selectedHoliday && (
                    <View style={[styles.holidayBadge, selectedHoliday.women_only && styles.holidayBadgePurple]}>
                      <Ionicons name="flag" size={13} color="#fff" />
                      <Text style={styles.holidayBadgeText}>
                        {selectedHoliday.name}{selectedHoliday.name_np ? ` · ${selectedHoliday.name_np}` : ''}
                      </Text>
                    </View>
                  )}

                  {!selectedHoliday && (
                    <Text style={styles.infoNormal}>Regular working day</Text>
                  )}
                </View>
              )}

              {/* Holidays this month */}
              {holidays.filter(h => h.bs_month === month).length > 0 && (
                <View style={styles.listCard}>
                  <Text style={styles.listCardTitle}>
                    <Ionicons name="flag-outline" size={14} color={colors.danger} /> Holidays this month
                  </Text>
                  {holidays.filter(h => h.bs_month === month).map((h, i, arr) => (
                    <View key={h.id} style={[styles.listItem, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[styles.listDot, h.women_only && { backgroundColor: colors.purple }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listItemName}>{h.name}</Text>
                        {h.name_np ? <Text style={styles.listItemNp}>{h.name_np}</Text> : null}
                        <Text style={styles.listItemDate}>
                          {BS_MONTHS_NP[month - 1]} {toNepaliNumeral(h.bs_day)}
                          {h.bs_day_end ? `–${toNepaliNumeral(h.bs_day_end)}` : ''}
                          {h.ad_date ? `  ·  ${h.ad_date}` : ''}
                        </Text>
                      </View>
                      {h.women_only && (
                        <View style={styles.womenBadge}>
                          <Text style={styles.womenBadgeText}>Women</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendCircle, { backgroundColor: colors.primary }]} />
                  <Text style={styles.legendText}>Today</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.legendText}>Holiday</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.purple }]} />
                  <Text style={styles.legendText}>Women only</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={[styles.legendText, { color: colors.danger, fontWeight: '700', marginRight: 2 }]}>शनि</Text>
                  <Text style={styles.legendText}>Saturday</Text>
                </View>
              </View>
            </>
          )}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 4,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  // Navigation
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
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
    ...shadows.sm,
  },
  monthCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  monthNp: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  monthEn: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  adRangePill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  adRangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },

  // Calendar card
  calendarCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  weekRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekCell: {
    width: CELL_W,
    alignItems: 'center',
    paddingVertical: 9,
  },
  weekCellSat: {},
  weekText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  satLabel: { color: colors.danger },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  selectedCell: {
    backgroundColor: colors.primaryLight,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: colors.primary,
  },
  dayNp: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  todayDayNp: {
    color: '#fff',
    fontWeight: '800',
  },
  selectedDayNp: {
    color: colors.primary,
    fontWeight: '800',
  },
  holidayDayNp: {
    color: colors.danger,
    fontWeight: '700',
  },
  satDayNp: {
    color: colors.danger,
  },
  dayEn: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  todayDayEn: { color: colors.primary },
  selectedDayEn: { color: colors.primary },
  redDayEn: { color: colors.dangerMuted },

  // Dots — flex layout, no absolute positioning
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    alignItems: 'center',
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotRed: { backgroundColor: colors.danger },
  dotPurple: { backgroundColor: colors.purple },
  dotBlue: { backgroundColor: colors.primary },

  // Selected day info card
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoBsBlock: { flex: 1, alignItems: 'center' },
  infoBsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  infoBsDate: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  infoBsMonthName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoSep: {
    width: 1,
    height: 48,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  infoAdBlock: { flex: 1, alignItems: 'center' },
  infoAdLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  infoAdDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  infoAdDay: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoNormal: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  holidayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  holidayBadgePurple: { backgroundColor: colors.purple },
  holidayBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  designEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.purpleLight,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  designEventEmoji: { fontSize: 18 },
  designEventName: { fontSize: 13, fontWeight: '600', color: colors.purple },
  designEventMeta: { fontSize: 11, color: '#7c3aed', textTransform: 'capitalize', marginTop: 1 },

  // List cards (holidays, design events)
  listCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    ...shadows.sm,
  },
  listCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginTop: 5,
  },
  listItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  listItemNp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  listItemDate: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 3,
  },
  womenBadge: {
    backgroundColor: colors.purpleLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  womenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.purple,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Holiday Notice
  noticeCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  noticeHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  noticeCompany: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  noticeSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  noticeSubject: {
    fontSize: 13,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  noticeBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.text,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  thText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowEven: { backgroundColor: colors.background },
  tdText: { fontSize: 12, color: colors.text },
  tdNp: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  womenTag: {
    fontSize: 9,
    color: colors.purple,
    fontWeight: '700',
    marginTop: 2,
  },
  noticeNotes: { marginTop: spacing.lg },
  noticeNotesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  noticeNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 17,
  },
  noticeSignature: {
    alignItems: 'flex-end',
    marginTop: spacing.xxl + spacing.lg,
  },
  signatureLine: {
    width: 160,
    borderTopWidth: 1,
    borderTopColor: colors.textTertiary,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  signatureDept: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
