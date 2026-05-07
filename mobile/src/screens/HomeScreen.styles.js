import { StyleSheet, Platform, StatusBar } from 'react-native';
import { colors, spacing, shadows, radius } from '../theme';

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // ─ Header ─
  headerBg: {
    backgroundColor: colors.headerDark,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  headerRight: {},
  greeting: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  name: {
    fontSize: 26, fontWeight: '800', color: colors.textInverse,
    marginTop: 2, letterSpacing: -0.5,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: { fontSize: 19, fontWeight: '800', color: colors.textInverse },
  dateTimeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.md,
  },
  dateTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  dateTimeDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#475569' },

  // ─ Content ─
  scrollArea: { flex: 1, marginTop: -20 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },

  // ─ Attendance Card ─
  attendanceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: 'hidden', marginBottom: spacing.xl,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.md,
  },
  attCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl, paddingBottom: spacing.md,
  },
  attCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Timeline
  timelineRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
  },
  timelineNode: { alignItems: 'center', width: 56 },
  timelineDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  timelineDotActive: { backgroundColor: colors.success },
  timelineDotDanger: { backgroundColor: colors.dangerMuted },
  timelineDotInactive: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border },
  timelineLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1 },
  timelineTime: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },
  timelineLine: {
    flex: 1, height: 3, backgroundColor: colors.border,
    borderRadius: 2, overflow: 'hidden', marginBottom: 24,
  },
  timelineLineFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  timelineDuration: { alignItems: 'center', marginBottom: 24, marginHorizontal: 4 },
  durationCircle: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 3, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  durationValue: { fontSize: 20, fontWeight: '900', color: colors.primary, lineHeight: 22 },
  durationUnit: { fontSize: 9, fontWeight: '700', color: colors.primaryMuted, marginTop: -1 },

  // Not checked in
  notCheckedInBox: {
    alignItems: 'center', paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  notCheckedInCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  notCheckedInText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  notCheckedInSub: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },

  // Actions
  attActionArea: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  checkInBtn: {
    backgroundColor: colors.success,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    ...shadows.sm,
  },
  checkOutBtn: {
    backgroundColor: colors.dangerMuted,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    ...shadows.sm,
  },
  btnIconCircle: {
    position: 'absolute', left: spacing.lg,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(5,150,105,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { color: colors.white, fontSize: 16, fontWeight: '700', marginRight: 6 },
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.successLight, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.success + '30',
  },
  completedCheckCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  completedTitle: { fontSize: 14, fontWeight: '700', color: colors.success },
  completedSub: { fontSize: 12, color: colors.successMuted, marginTop: 1 },

  // ─ Section headers ─
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  seeAllLink: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // ─ Mini Stats ─
  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  miniStat: {
    flex: 1, backgroundColor: colors.white,
    borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center', ...shadows.sm,
  },
  miniStatIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  miniStatValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  miniStatLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 1 },

  // ─ Admin Grid ─
  adminGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  adminCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, width: '48.5%', ...shadows.sm,
  },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  adminDot: { width: 8, height: 8, borderRadius: 4 },
  adminLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  adminValue: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

  // ─ Notice cards ─
  noticeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginBottom: spacing.sm, ...shadows.sm,
  },
  noticeIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  noticeBody: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },

  // ─ Leave info ─
  leaveInfoCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginTop: spacing.md, ...shadows.sm,
  },
  leaveInfoRow: { flexDirection: 'row', alignItems: 'center' },
  leaveInfoItem: { flex: 1, alignItems: 'center', gap: 4 },
  leaveInfoLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' },
  leaveInfoValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  leaveInfoDivider: { width: 1, height: 36, backgroundColor: colors.border },

  // ─ Shift card ─
  shiftCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginTop: spacing.md, ...shadows.sm,
  },
  shiftCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  shiftCardTitle: {
    fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: 0.3,
  },
  shiftCardGrid: { gap: 8 },
  shiftCardItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  shiftCardLabel: {
    fontSize: 13, color: colors.textSecondary, fontWeight: '500',
  },
});
