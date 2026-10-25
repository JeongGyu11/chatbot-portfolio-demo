// All documents, identities and amounts are invented for this independent demo.
export const users = Object.freeze({
  member: { id: 'demo-member', name: '일반 구성원', permissions: ['general'] },
  reviewer: { id: 'demo-reviewer', name: '검토 담당자', permissions: ['general', 'review'] },
});
export const documents = [
  { id: 'leave', title: '휴가 신청 안내', version: '2.0', state: '적용 중', permission: 'general', sections: [
    { id: 'request', heading: '제1조 신청 절차', text: '휴가 신청은 시작일 3영업일 전까지 업무 포털에서 제출합니다. 긴급한 경우 담당자에게 사유를 알리고 사후 신청할 수 있습니다.' },
    { id: 'change', heading: '제2조 변경 및 취소', text: '승인된 휴가는 시작일 전에 변경 또는 취소를 요청할 수 있습니다. 변경 후에는 검토자의 재승인을 받아야 합니다.' },
  ] },
  { id: 'expenses', title: '교육비 지원 안내', version: '1.1', state: '적용 중', permission: 'general', sections: [
    { id: 'limit', heading: '제1조 지원 한도', text: '교육비 지원 한도는 구성원 1명당 연간 30만원입니다. 사전에 승인된 직무 관련 교육에 한해 실제 결제 금액을 지원합니다.' },
    { id: 'receipt', heading: '제2조 증빙 제출', text: '교육비 정산 시 수료증과 결제 영수증을 제출합니다. 교육 종료 후 14일 이내에 증빙을 등록합니다.' },
  ] },
  { id: 'review-policy', title: '내부 검토 지침', version: '1.0', state: '검토 전용', permission: 'review', sections: [
    { id: 'restricted', heading: '제1조 검토 기준', text: '내부 검토 지침의 예외 승인 한도는 70만원입니다. 예외 승인에는 별도 검토 사유와 담당자의 확인이 필요합니다.' },
  ] },
];
export const tasks = [
  { id: 'T-101', title: '교육비 지원 신청 검토', status: '대기', permission: 'general' },
  { id: 'T-102', title: '휴가 변경 신청 검토', status: '완료', permission: 'general' },
  { id: 'T-103', title: '예외 승인 요청 검토', status: '대기', permission: 'review' },
];
