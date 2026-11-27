/** Seed content used on first run of the local CMS. Every field is editable via PUT /api/config. */
import type { InvitationContent, WeddingConfig } from './types';

export const DEFAULT_INVITATION: InvitationContent = {
  coverEyebrow: 'Thư mời hạnh phúc từ',
  openHint: 'Cuộn xuống để mở thiệp',
  archTitle: 'Thiệp Mời',
  announceArchTitle: 'Báo Hỉ',
  monogram: '',
  momentLine: 'Khoảnh khắc ấy đã đến…',
  scriptHeadline: 'Chúng mình về chung một nhà',
  joinLine: 'Trân trọng kính mời',
  inviteLine: 'Tới dự bữa cơm thân mật mừng lễ thành hôn\nchung vui cùng gia đình chúng tôi',
  presenceLine: 'Sự hiện diện của {khach}\nlà niềm vinh hạnh cho gia đình chúng tôi!',
  ceremonyWelcome: 'Rất hân hạnh được đón tiếp!',
  place: '',
  calendarTitle: 'Ngày chung đôi',
  countdownTitle: 'Hẹn gặp bạn trong ngày vui',
  countdownDoneText: 'Cảm ơn bạn đã cùng chung vui',
  rsvpTitle: 'Bạn sẽ đến chung vui chứ?',
  rsvpNote: 'Mong bạn xác nhận tham dự để chúng mình chuẩn bị chu đáo nhất.',
  closingTitle: 'Thân thương',
  closingNote: 'Mọi thắc mắc xin liên hệ cô dâu & chú rể',
  groomPhone: '',
  bridePhone: '',
};

export const DEFAULT_CONFIG: WeddingConfig = {
  groomName: 'Minh Quân',
  brideName: 'Thu Hà',
  groomParents: { father: 'Ông Nguyễn Văn Hùng', mother: 'Bà Trần Thị Mai', address: 'Quận 3, TP. Hồ Chí Minh' },
  brideParents: { father: 'Ông Lê Văn Phúc', mother: 'Bà Phạm Thị Lan', address: 'TP. Cần Thơ' },
  headline: 'Trân trọng báo tin lễ thành hôn',
  story: 'Từ những ngày đầu gặp gỡ đến hôm nay, chúng mình đã cùng nhau đi qua thật nhiều kỷ niệm. Và giờ đây, chúng mình muốn được cùng gia đình và bạn bè chia sẻ khoảnh khắc trọng đại nhất.',
  ceremony: {
    title: 'Lễ Thành Hôn',
    datetime: '2027-01-16T09:00:00+07:00',
    venueName: 'Tư gia nhà gái',
    address: '123 Đường Hoà Bình, Quận Ninh Kiều, TP. Cần Thơ',
  },
  reception: {
    title: 'Tiệc Cưới',
    datetime: '2027-01-16T18:00:00+07:00',
    venueName: 'Trung tâm Hội nghị Tiệc cưới Hoa Sen',
    hallName: 'Sảnh Ngọc Lan',
    address: '45 Đại lộ Nguyễn Văn Linh, Quận Ninh Kiều, TP. Cần Thơ',
  },
  googleMapsUrl: 'https://maps.google.com/?q=45+Nguyen+Van+Linh+Ninh+Kieu+Can+Tho',
  googleMapsEmbedUrl: 'https://maps.google.com/maps?q=45+Nguyen+Van+Linh+Ninh+Kieu+Can+Tho&output=embed',
  siteBaseUrl: 'https://example.com',
  rsvpWebhookUrl: '',
  rsvpForm: {
    formId: '1FAIpQLSe5NepJTUAt-RkW1IXkMkqZ-K-VrZ0Jou-ugnl-TemNdl00vA',
    entryFullName: '895620619',
    entryPhone: '50183105',
    entryRelationship: '1545696181',
    entryAttendees: '261159171',
  },
  invitation: { ...DEFAULT_INVITATION },
};

/** Initials of the given (last) names: "Hoàng Trung" + "Bảo Châu" -> "T&C". */
export function defaultMonogram(groomName: string, brideName: string): string {
  const initial = (n: string) => (n.trim().split(/\s+/).pop() ?? '').charAt(0).toLocaleUpperCase('vi');
  return `${initial(groomName)}&${initial(brideName)}`;
}

/** Invitation wording with defaults and derived values filled in. */
export function resolveInvitation(config: WeddingConfig): InvitationContent {
  const out = { ...DEFAULT_INVITATION };
  for (const [k, v] of Object.entries(config.invitation ?? {})) {
    if (typeof v === 'string' && v.trim()) out[k as keyof InvitationContent] = v.trim();
  }
  if (!out.monogram) out.monogram = defaultMonogram(config.groomName, config.brideName);
  if (!out.place) out.place = config.reception.address.split(',').pop()?.trim() ?? '';
  return out;
}
