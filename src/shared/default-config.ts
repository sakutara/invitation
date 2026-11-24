/** Seed content used on first run of the local CMS. Every field is editable via PUT /api/config. */
import type { WeddingConfig } from './types';

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
};
