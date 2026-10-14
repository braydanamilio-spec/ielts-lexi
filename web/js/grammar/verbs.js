/* Ngữ pháp – Cấu trúc động từ (tự biên soạn) */
(function (g) {
  const G = g.GRAMMAR = g.GRAMMAR || [];

  /* 1. Modal verbs of ability & permission */
  G.push({
    id: 'modals-ability-permission', unit: 'verbs', order: 1,
    title: 'Động từ khuyết thiếu: khả năng & sự cho phép', en: 'Modals of Ability & Permission', level: 'A2', emoji: '💪',
    summary: 'Dùng can, could, be able to và may để nói về khả năng (hiện tại, quá khứ, tương lai) và để xin hoặc cho phép một cách lịch sự.',
    blocks: [
      { type: 'scale', caption: 'Mức độ trang trọng khi xin phép (0 = thân mật, 100 = rất trang trọng)', items: [ { t: 'Can I…?', v: 25 }, { t: 'Could I…?', v: 55 }, { t: 'May I…?', v: 80 }, { t: 'Might I…?', v: 95 } ] },
      { type: 'formula', rows: [
        { label: 'Khả năng hiện tại', parts: [ { t: 'S', c: 'subj' }, { t: 'can / can\'t', c: 'aux' }, { t: 'V (nguyên mẫu)', c: 'verb' } ], ex: 'Many teenagers can code basic websites.' },
        { label: 'Khả năng chung trong quá khứ', parts: [ { t: 'S', c: 'subj' }, { t: 'could', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'My grandmother could speak three languages.' },
        { label: 'Làm được một việc cụ thể', parts: [ { t: 'S', c: 'subj' }, { t: 'was/were able to', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'Despite the storm, the team was able to finish the survey.' },
        { label: 'Xin phép', parts: [ { t: 'Can/Could/May', c: 'aux' }, { t: 'I', c: 'subj' }, { t: 'V', c: 'verb' }, { t: '…?', c: 'obj' } ], ex: 'May I borrow your notes for the lecture?' }
      ] },
      { type: 'uses', items: [
        { title: 'Khả năng ở hiện tại', ex: 'Solar panels can now generate power even on cloudy days.', vi: 'Pin mặt trời giờ có thể tạo ra điện ngay cả vào những ngày nhiều mây.' },
        { title: 'Khả năng chung trong quá khứ (could)', ex: 'In the 1990s, few people could afford a mobile phone.', vi: 'Vào những năm 1990, rất ít người có đủ tiền mua điện thoại di động.' },
        { title: 'Thành công trong một tình huống cụ thể (was able to / managed to)', ex: 'After three attempts, she was able to get a band 7.5.', vi: 'Sau ba lần thi, cô ấy đã đạt được band 7.5.' },
        { title: 'Khả năng ở tương lai / hoàn thành (dùng be able to)', ex: 'By 2030, most cities will be able to recycle 60% of their waste.', vi: 'Đến năm 2030, hầu hết các thành phố sẽ có thể tái chế 60% rác thải.' },
        { title: 'Xin phép và cho phép', ex: 'Students may use a dictionary during the first part of the test.', vi: 'Thí sinh được phép dùng từ điển trong phần đầu của bài thi.' }
      ] },
      { type: 'table', head: ['Thời điểm', 'Khả năng', 'Phủ định'], rows: [
        ['Hiện tại', 'can / am able to', 'can\'t / cannot'],
        ['Quá khứ (chung)', 'could / was able to', 'couldn\'t'],
        ['Quá khứ (một lần cụ thể)', 'was able to / managed to', 'couldn\'t / wasn\'t able to'],
        ['Tương lai', 'will be able to', 'won\'t be able to'],
        ['Hiện tại hoàn thành', 'have been able to', 'haven\'t been able to']
      ] },
      { type: 'tip', text: 'Can không có dạng nguyên mẫu hay V3, nên sau will, have, might… phải dùng be able to: will be able to, have been able to, might be able to.' },
      { type: 'tip', text: 'Ở dạng phủ định, couldn\'t dùng được cho cả khả năng chung lẫn một lần cụ thể: I couldn\'t open the file yesterday.' },
      { type: 'mistake', wrong: 'I will can attend the seminar next week.', right: 'I will be able to attend the seminar next week.', why: 'Không dùng hai động từ khuyết thiếu liền nhau; thay can bằng be able to.' },
      { type: 'mistake', wrong: 'The firefighters could rescue everyone yesterday.', right: 'The firefighters were able to rescue everyone yesterday.', why: 'Với một thành công cụ thể trong quá khứ, dùng was/were able to hoặc managed to, không dùng could.' },
      { type: 'mistake', wrong: 'She can to play the violin.', right: 'She can play the violin.', why: 'Sau động từ khuyết thiếu là động từ nguyên mẫu không to.' },
      { type: 'ielts', text: 'Trong Writing Task 2, dùng can/could để đưa ra khả năng một cách thận trọng (hedging) thay vì khẳng định tuyệt đối. Trong Speaking Part 1, kết hợp used to be able to để so sánh quá khứ với hiện tại.', ex: 'Online courses can give people in rural areas access to high-quality education.' }
    ],
    quiz: [
      { q: 'Last night the internet went down, but luckily I ___ submit my essay before midnight.', options: ['could', 'was able to', 'can', 'am able to'], answer: 1, explain: 'Một thành công cụ thể trong quá khứ → was able to.' },
      { q: 'When I was five, I ___ read simple stories.', options: ['could', 'can', 'will be able to', 'may'], answer: 0, explain: 'Khả năng chung trong quá khứ → could.' },
      { q: 'If you practise every day, you ___ speak more fluently in a few months.', options: ['can', 'could', 'will be able to', 'were able to'], answer: 2, explain: 'Khả năng ở tương lai → will be able to.' },
      { q: '___ I leave the room for a moment, please? (rất lịch sự với giám khảo)', options: ['May', 'Must', 'Will', 'Should'], answer: 0, explain: 'May I…? là cách xin phép trang trọng.' },
      { q: 'Since she moved to London, she ___ improve her listening skills a lot.', options: ['can', 'could', 'has been able to', 'is able'], answer: 2, explain: 'Thì hiện tại hoàn thành (since…) → has been able to.' },
      { q: 'Câu nào ĐÚNG?', options: ['He musts can swim.', 'He might be able to help us.', 'He can to drive.', 'He will can come.'], answer: 1, explain: 'Sau might phải dùng be able to; các câu còn lại sai cấu trúc.' }
    ]
  });

  /* 2. Modals of obligation & advice */
  G.push({
    id: 'modals-obligation-advice', unit: 'verbs', order: 2,
    title: 'Động từ khuyết thiếu: bắt buộc & lời khuyên', en: 'Modals of Obligation & Advice', level: 'B1', emoji: '📏',
    summary: 'Phân biệt must, have to, should, ought to và need để diễn tả nghĩa vụ, sự cần thiết, điều cấm và lời khuyên.',
    blocks: [
      { type: 'scale', caption: 'Độ mạnh của nghĩa vụ (0 = chỉ là gợi ý, 100 = bắt buộc tuyệt đối)', items: [ { t: 'must / have to', v: 95 }, { t: 'need to', v: 75 }, { t: 'had better', v: 65 }, { t: 'should / ought to', v: 50 }, { t: 'could (gợi ý)', v: 20 } ] },
      { type: 'formula', rows: [
        { label: 'Bắt buộc', parts: [ { t: 'S', c: 'subj' }, { t: 'must / have to', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'All applicants must submit their passports.' },
        { label: 'Cấm', parts: [ { t: 'S', c: 'subj' }, { t: 'mustn\'t', c: 'neg' }, { t: 'V', c: 'verb' } ], ex: 'You mustn\'t use your phone in the exam room.' },
        { label: 'Không cần thiết', parts: [ { t: 'S', c: 'subj' }, { t: 'don\'t have to / needn\'t', c: 'neg' }, { t: 'V', c: 'verb' } ], ex: 'You don\'t have to bring a pencil; we provide one.' },
        { label: 'Lời khuyên', parts: [ { t: 'S', c: 'subj' }, { t: 'should / ought to', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'Governments should invest more in public transport.' },
        { label: 'Lời khuyên muộn (quá khứ)', parts: [ { t: 'S', c: 'subj' }, { t: 'should have', c: 'aux' }, { t: 'V3', c: 'verb' } ], ex: 'I should have read the instructions more carefully.' }
      ] },
      { type: 'uses', items: [
        { title: 'Must: nghĩa vụ do người nói đặt ra / quy định viết', ex: 'I must remember to book the speaking test this week.', vi: 'Tôi phải nhớ đăng ký thi nói trong tuần này.' },
        { title: 'Have to: nghĩa vụ từ bên ngoài (luật, nội quy, hoàn cảnh)', ex: 'Nurses often have to work night shifts.', vi: 'Y tá thường phải làm ca đêm.' },
        { title: 'Mustn\'t ≠ don\'t have to', ex: 'You mustn\'t cheat, but you don\'t have to answer the questions in order.', vi: 'Bạn không được gian lận, nhưng bạn không bắt buộc phải trả lời câu hỏi theo thứ tự.' },
        { title: 'Should / ought to: lời khuyên, ý kiến', ex: 'Parents ought to limit the time children spend on screens.', vi: 'Cha mẹ nên hạn chế thời gian trẻ em dùng màn hình.' },
        { title: 'Needn\'t have V3 ≠ didn\'t need to V', ex: 'We needn\'t have hurried – the lecture started late.', vi: 'Lẽ ra chúng tôi không cần vội – buổi giảng bắt đầu muộn (nhưng đã vội rồi).' }
      ] },
      { type: 'table', head: ['Ý nghĩa', 'Hiện tại', 'Quá khứ'], rows: [
        ['Bắt buộc', 'must / have to', 'had to'],
        ['Không cần thiết', 'don\'t have to / needn\'t', 'didn\'t have to / didn\'t need to'],
        ['Cấm', 'mustn\'t / can\'t', 'wasn\'t allowed to / couldn\'t'],
        ['Lời khuyên', 'should / ought to', 'should have V3 (hối tiếc, phê bình)'],
        ['Cảnh báo mạnh', 'had better (not)', '—']
      ] },
      { type: 'tip', text: 'Must không có dạng quá khứ để chỉ nghĩa vụ. Muốn nói "đã phải" thì dùng had to: Yesterday I had to queue for an hour.' },
      { type: 'tip', text: 'Had better mạnh hơn should và hàm ý hậu quả xấu nếu không làm: You\'d better leave now or you\'ll miss the train.' },
      { type: 'mistake', wrong: 'You mustn\'t bring food; the canteen is open. (ý: không cần mang)', right: 'You don\'t have to bring food; the canteen is open.', why: 'Mustn\'t = cấm; "không cần" phải dùng don\'t have to hoặc needn\'t. Người Việt hay dịch "không phải" thành mustn\'t.' },
      { type: 'mistake', wrong: 'Yesterday I must finish my assignment.', right: 'Yesterday I had to finish my assignment.', why: 'Nghĩa vụ trong quá khứ dùng had to.' },
      { type: 'mistake', wrong: 'Students should to wear uniforms.', right: 'Students should wear uniforms.', why: 'Should đi với V nguyên mẫu không to (chỉ ought to và have to mới có to).' },
      { type: 'ielts', text: 'Writing Task 2 dạng "Should…?" hoặc đưa giải pháp: dùng should / ought to / need to để đề xuất; dùng must cho điều bạn cho là bắt buộc. Tránh lặp lại should – xen kẽ it is essential that…, it is vital to….', ex: 'Local authorities need to provide safer cycling routes, and drivers ought to be more aware of cyclists.' }
    ],
    quiz: [
      { q: 'In many countries, drivers ___ wear a seatbelt by law.', options: ['have to', 'should', 'needn\'t', 'could'], answer: 0, explain: 'Nghĩa vụ do luật pháp (bên ngoài) → have to.' },
      { q: 'You ___ smoke inside the hospital. It\'s strictly forbidden.', options: ['don\'t have to', 'mustn\'t', 'needn\'t', 'ought to'], answer: 1, explain: 'Cấm → mustn\'t.' },
      { q: 'It\'s a free event, so you ___ buy a ticket.', options: ['mustn\'t', 'have to', 'don\'t have to', 'must'], answer: 2, explain: 'Không cần thiết → don\'t have to.' },
      { q: 'I failed the test. I ___ more vocabulary.', options: ['should learn', 'should have learnt', 'must learn', 'had to learn'], answer: 1, explain: 'Hối tiếc về việc lẽ ra nên làm trong quá khứ → should have + V3.' },
      { q: 'Last year, all staff ___ attend a safety course.', options: ['must', 'had to', 'have to', 'should'], answer: 1, explain: 'Nghĩa vụ trong quá khứ → had to.' },
      { q: 'We ___ have taken a taxi – the station was only five minutes away.', options: ['mustn\'t', 'needn\'t', 'shouldn\'t to', 'didn\'t need'], answer: 1, explain: 'Needn\'t have V3: đã làm nhưng hóa ra không cần.' }
    ]
  });

  /* 3. Modals of possibility & deduction */
  G.push({
    id: 'modals-deduction', unit: 'verbs', order: 3,
    title: 'Động từ khuyết thiếu: khả năng xảy ra & suy đoán', en: 'Modals of Possibility & Deduction', level: 'B2', emoji: '🔍',
    summary: 'Dùng must, may, might, could, can\'t (+ have V3) để suy luận mức độ chắc chắn về hiện tại và quá khứ.',
    blocks: [
      { type: 'scale', caption: 'Mức độ chắc chắn của người nói (%)', items: [ { t: 'must (chắc chắn đúng)', v: 95 }, { t: 'should / will probably', v: 75 }, { t: 'may', v: 50 }, { t: 'might / could', v: 35 }, { t: 'can\'t / couldn\'t', v: 3 } ] },
      { type: 'formula', rows: [
        { label: 'Suy đoán hiện tại', parts: [ { t: 'S', c: 'subj' }, { t: 'must/may/might/can\'t', c: 'aux' }, { t: 'V / be V-ing', c: 'verb' } ], ex: 'The lights are off – they must be asleep.' },
        { label: 'Suy đoán quá khứ', parts: [ { t: 'S', c: 'subj' }, { t: 'must/might/can\'t', c: 'aux' }, { t: 'have', c: 'aux' }, { t: 'V3', c: 'verb' } ], ex: 'She can\'t have seen the email; she was on a flight.' },
        { label: 'Phủ định không chắc', parts: [ { t: 'S', c: 'subj' }, { t: 'may not / might not', c: 'neg' }, { t: 'V', c: 'verb' } ], ex: 'The results might not be reliable.' }
      ] },
      { type: 'uses', items: [
        { title: 'Must: kết luận gần như chắc chắn dựa trên bằng chứng', ex: 'He has lived in Tokyo for ten years, so he must speak Japanese.', vi: 'Anh ấy sống ở Tokyo mười năm rồi nên chắc chắn nói được tiếng Nhật.' },
        { title: 'Can\'t: gần như chắc chắn là không', ex: 'That can\'t be the right answer – it\'s far too high.', vi: 'Đó không thể là đáp án đúng – nó cao quá.' },
        { title: 'May / might / could: có thể (không chắc)', ex: 'Rising temperatures could lead to more frequent floods.', vi: 'Nhiệt độ tăng có thể dẫn đến lũ lụt thường xuyên hơn.' },
        { title: 'Must have V3: chắc hẳn đã', ex: 'The road is wet. It must have rained overnight.', vi: 'Đường ướt. Chắc hẳn đêm qua trời đã mưa.' },
        { title: 'Might have / could have V3: có lẽ đã (hoặc suýt nữa)', ex: 'The ancient city might have been destroyed by an earthquake.', vi: 'Thành cổ có lẽ đã bị phá hủy bởi một trận động đất.' }
      ] },
      { type: 'table', head: ['Mức độ', 'Hiện tại', 'Quá khứ'], rows: [
        ['Chắc chắn có', 'must + V', 'must have + V3'],
        ['Có thể', 'may / might / could + V', 'may / might / could have + V3'],
        ['Có thể không', 'may not / might not + V', 'may not / might not have + V3'],
        ['Chắc chắn không', 'can\'t / couldn\'t + V', 'can\'t / couldn\'t have + V3']
      ] },
      { type: 'tip', text: 'Phủ định của must (suy đoán) KHÔNG phải mustn\'t mà là can\'t. Mustn\'t chỉ mang nghĩa cấm.' },
      { type: 'tip', text: 'Could have V3 còn có nghĩa "lẽ ra đã có thể" (nhưng không làm): You could have asked me for help.' },
      { type: 'mistake', wrong: 'He mustn\'t be at home – his car isn\'t there.', right: 'He can\'t be at home – his car isn\'t there.', why: 'Suy đoán phủ định dùng can\'t; mustn\'t là cấm đoán.' },
      { type: 'mistake', wrong: 'She must forget the meeting yesterday.', right: 'She must have forgotten the meeting yesterday.', why: 'Suy đoán về quá khứ phải dùng modal + have + V3.' },
      { type: 'mistake', wrong: 'Maybe the data might be wrong.', right: 'The data might be wrong. / Maybe the data is wrong.', why: 'Maybe và might cùng nghĩa; dùng cả hai là thừa – lỗi rất hay gặp do dịch "có lẽ có thể".' },
      { type: 'ielts', text: 'Writing Task 1 và Task 2: dùng may/might/could để hedging khi đưa ra nguyên nhân hoặc dự đoán, tránh khẳng định quá mức. Speaking Part 2/3: dùng must have/might have khi suy đoán về lý do trong quá khứ.', ex: 'The sharp drop in visitor numbers in 2020 must have been caused by travel restrictions.' }
    ],
    quiz: [
      { q: 'She\'s been studying all night. She ___ be exhausted.', options: ['must', 'can\'t', 'mustn\'t', 'needn\'t'], answer: 0, explain: 'Suy luận chắc chắn dựa trên bằng chứng → must.' },
      { q: 'That ___ be Tom; he\'s in Australia this month.', options: ['must', 'might', 'can\'t', 'should'], answer: 2, explain: 'Chắc chắn không → can\'t.' },
      { q: 'I can\'t find my keys. I ___ them at the library.', options: ['might leave', 'might have left', 'must leave', 'can\'t have leave'], answer: 1, explain: 'Khả năng trong quá khứ → might have + V3.' },
      { q: 'The museum is closed. It ___ have been renovated.', options: ['must', 'can\'t', 'mustn\'t', 'should'], answer: 0, explain: 'Kết luận chắc chắn về quá khứ → must have V3.' },
      { q: 'He ___ have written this essay alone – it\'s full of advanced vocabulary he never uses.', options: ['must', 'might', 'can\'t', 'should'], answer: 2, explain: 'Gần như chắc chắn không → can\'t have V3.' },
      { q: 'Electric cars ___ become cheaper than petrol cars in the next decade. (không chắc)', options: ['must', 'could', 'can\'t', 'mustn\'t'], answer: 1, explain: 'Khả năng không chắc chắn trong tương lai → could/might/may.' }
    ]
  });

  /* 4. Passive voice */
  G.push({
    id: 'passive-voice', unit: 'verbs', order: 4,
    title: 'Câu bị động', en: 'Passive Voice', level: 'B1', emoji: '🔄',
    summary: 'Câu bị động (be + V3) đưa đối tượng chịu tác động lên làm chủ ngữ, rất phổ biến trong văn viết học thuật và IELTS Writing.',
    blocks: [
      { type: 'diagram', caption: 'Biến đổi từ chủ động sang bị động', steps: [
        { t: 'Engineers built the bridge in 2015.', c: 'active' },
        { t: '↓ tân ngữ (the bridge) lên làm chủ ngữ', c: 'arrow' },
        { t: '↓ động từ → be (chia theo thì gốc) + V3', c: 'arrow' },
        { t: 'The bridge was built (by engineers) in 2015.', c: 'passive' },
        { t: 'by + tác nhân thường bị lược bỏ nếu không quan trọng', c: 'note' }
      ] },
      { type: 'formula', rows: [
        { label: 'Bị động', parts: [ { t: 'S', c: 'subj' }, { t: 'be', c: 'aux' }, { t: 'V3/V-ed', c: 'verb' }, { t: '(by O)', c: 'obj' } ], ex: 'The report was published in 2023.' },
        { label: 'Với modal', parts: [ { t: 'S', c: 'subj' }, { t: 'modal + be', c: 'aux' }, { t: 'V3', c: 'verb' } ], ex: 'Plastic bags should be banned.' },
        { label: 'Phủ định', parts: [ { t: 'S', c: 'subj' }, { t: 'be + not', c: 'neg' }, { t: 'V3', c: 'verb' } ], ex: 'The data was not collected properly.' }
      ] },
      { type: 'uses', items: [
        { title: 'Tác nhân không rõ, không quan trọng hoặc hiển nhiên', ex: 'Thousands of trees are cut down every day.', vi: 'Hàng nghìn cây bị chặt hạ mỗi ngày.' },
        { title: 'Nhấn mạnh hành động/kết quả hơn người làm', ex: 'A new vaccine has been developed.', vi: 'Một loại vắc-xin mới đã được phát triển.' },
        { title: 'Mô tả quy trình (IELTS Task 1 – process)', ex: 'The clay is shaped, and then it is fired in a kiln.', vi: 'Đất sét được tạo hình, sau đó được nung trong lò.' },
        { title: 'Văn phong khách quan, trang trọng', ex: 'It has been argued that tourism damages local cultures.', vi: 'Người ta lập luận rằng du lịch gây tổn hại cho văn hóa địa phương.' },
        { title: 'Giữ chủ đề nhất quán trong đoạn văn', ex: 'The Eiffel Tower is in Paris. It was completed in 1889.', vi: 'Tháp Eiffel nằm ở Paris. Nó được hoàn thành năm 1889.' }
      ] },
      { type: 'table', head: ['Thì', 'Chủ động', 'Bị động'], rows: [
        ['Hiện tại đơn', 'They make cars here.', 'Cars are made here.'],
        ['Hiện tại tiếp diễn', 'They are building a dam.', 'A dam is being built.'],
        ['Hiện tại hoàn thành', 'They have closed the factory.', 'The factory has been closed.'],
        ['Quá khứ đơn', 'They invented it in 1876.', 'It was invented in 1876.'],
        ['Quá khứ tiếp diễn', 'They were repairing the road.', 'The road was being repaired.'],
        ['Quá khứ hoàn thành', 'They had sold all the tickets.', 'All the tickets had been sold.'],
        ['Tương lai đơn', 'They will announce the results.', 'The results will be announced.'],
        ['Modal', 'We must reduce emissions.', 'Emissions must be reduced.']
      ] },
      { type: 'tip', text: 'Chỉ ngoại động từ (có tân ngữ) mới chuyển được sang bị động. Các động từ như happen, occur, arrive, die, rise, fall không có dạng bị động.' },
      { type: 'tip', text: 'Chỉ giữ "by + tác nhân" khi nó mang thông tin mới hoặc quan trọng: The novel was written by a 17-year-old student.' },
      { type: 'mistake', wrong: 'The accident was happened at night.', right: 'The accident happened at night.', why: 'Happen là nội động từ, không có bị động. Người Việt hay thêm "bị/được" theo thói quen.' },
      { type: 'mistake', wrong: 'The houses are build of wood.', right: 'The houses are built of wood.', why: 'Sau be phải là V3 (built), không phải V nguyên mẫu.' },
      { type: 'mistake', wrong: 'Unemployment was risen sharply in 2010.', right: 'Unemployment rose sharply in 2010.', why: 'Rise là nội động từ; khi mô tả số liệu tăng/giảm dùng chủ động. (Raise mới là ngoại động từ.)' },
      { type: 'ielts', text: 'Task 1 dạng process / map gần như bắt buộc dùng bị động (is collected, was replaced, has been converted). Task 2 dùng bị động để khách quan hóa lập luận, nhưng đừng lạm dụng – xen kẽ với câu chủ động cho rõ nghĩa.', ex: 'Between 1995 and 2015, the old warehouses were demolished and a shopping centre was constructed.' }
    ],
    quiz: [
      { q: 'English ___ in many countries as an official language.', options: ['uses', 'is used', 'is using', 'used'], answer: 1, explain: 'Sự thật chung, chủ ngữ chịu tác động → hiện tại đơn bị động: is used.' },
      { q: 'A new hospital ___ at the moment.', options: ['is built', 'is being built', 'has built', 'builds'], answer: 1, explain: 'At the moment → hiện tại tiếp diễn bị động: is being built.' },
      { q: 'The results ___ next Monday.', options: ['will announce', 'will be announced', 'are announcing', 'announced'], answer: 1, explain: 'Tương lai đơn bị động: will be + V3.' },
      { q: 'Câu nào SAI?', options: ['The letter was sent yesterday.', 'The problem has been solved.', 'The earthquake was occurred in 2011.', 'Rice is grown in the Mekong Delta.'], answer: 2, explain: 'Occur là nội động từ, không có bị động → The earthquake occurred in 2011.' },
      { q: 'By the time we arrived, all the seats ___.', options: ['had taken', 'had been taken', 'were taking', 'have been taken'], answer: 1, explain: 'Hành động xảy ra trước một mốc quá khứ → quá khứ hoàn thành bị động.' },
      { q: 'Carbon emissions must ___ significantly.', options: ['reduce', 'be reduced', 'reduced', 'being reduced'], answer: 1, explain: 'Modal + be + V3.' }
    ]
  });

  /* 5. Passive reporting & causative */
  G.push({
    id: 'passive-reporting-causative', unit: 'verbs', order: 5,
    title: 'Bị động tường thuật & thể sai khiến', en: 'Passive Reporting & Causative', level: 'B2', emoji: '📰',
    summary: 'Dùng It is said that… / S is believed to… để nêu ý kiến chung một cách khách quan, và have/get something done để nói việc được người khác làm cho mình.',
    blocks: [
      { type: 'diagram', caption: 'Hai cách viết bị động với động từ tường thuật', steps: [
        { t: 'People believe that coffee improves concentration.', c: 'active' },
        { t: '↓ Cách 1: It + be + V3 + that…', c: 'arrow' },
        { t: 'It is believed that coffee improves concentration.', c: 'passive' },
        { t: '↓ Cách 2: chủ ngữ mệnh đề sau + be + V3 + to V', c: 'arrow' },
        { t: 'Coffee is believed to improve concentration.', c: 'passive' },
        { t: 'Sự việc xảy ra trước → to have V3: He is said to have left the country.', c: 'note' }
      ] },
      { type: 'formula', rows: [
        { label: 'Cách 1', parts: [ { t: 'It', c: 'subj' }, { t: 'is/was', c: 'aux' }, { t: 'said/thought/reported', c: 'verb' }, { t: 'that + mệnh đề', c: 'obj' } ], ex: 'It is reported that the company will cut 500 jobs.' },
        { label: 'Cách 2 (cùng thời)', parts: [ { t: 'S', c: 'subj' }, { t: 'is/was', c: 'aux' }, { t: 'said/believed', c: 'verb' }, { t: 'to V', c: 'obj' } ], ex: 'The painting is thought to be worth millions.' },
        { label: 'Cách 2 (xảy ra trước)', parts: [ { t: 'S', c: 'subj' }, { t: 'is/was', c: 'aux' }, { t: 'said/believed', c: 'verb' }, { t: 'to have V3', c: 'obj' } ], ex: 'The temple is believed to have been built in the 11th century.' },
        { label: 'Thể sai khiến', parts: [ { t: 'S', c: 'subj' }, { t: 'have/get', c: 'aux' }, { t: 'something', c: 'obj' }, { t: 'V3', c: 'verb' } ], ex: 'I had my eyes tested last week.' }
      ] },
      { type: 'uses', items: [
        { title: 'Trình bày quan điểm phổ biến mà không nêu nguồn cụ thể', ex: 'It is widely accepted that exercise reduces stress.', vi: 'Mọi người đều thừa nhận rằng tập thể dục giúp giảm căng thẳng.' },
        { title: 'Tin tức, báo cáo chưa được xác nhận', ex: 'The suspect is reported to have fled abroad.', vi: 'Nghi phạm được cho là đã trốn ra nước ngoài.' },
        { title: 'Have something done: thuê/nhờ người khác làm', ex: 'We are having our flat redecorated.', vi: 'Chúng tôi đang thuê người sửa sang lại căn hộ.' },
        { title: 'Get something done: thân mật hơn, đôi khi hàm ý nỗ lực', ex: 'I finally got my visa approved.', vi: 'Cuối cùng tôi cũng được duyệt visa.' },
        { title: 'Have something done: chuyện không may xảy ra với mình', ex: 'She had her wallet stolen on the bus.', vi: 'Cô ấy bị lấy cắp ví trên xe buýt.' }
      ] },
      { type: 'table', head: ['Chủ động', 'It + bị động', 'S + bị động + to V'], rows: [
        ['People say he is rich.', 'It is said that he is rich.', 'He is said to be rich.'],
        ['Experts think the virus came from bats.', 'It is thought that the virus came from bats.', 'The virus is thought to have come from bats.'],
        ['Police believed she was lying.', 'It was believed that she was lying.', 'She was believed to be lying.'],
        ['They expect prices to rise.', 'It is expected that prices will rise.', 'Prices are expected to rise.']
      ] },
      { type: 'tip', text: 'Các động từ hay dùng: say, think, believe, know, report, expect, consider, estimate, claim, allege. Với estimate thường dùng cách 1: It is estimated that 40% of…' },
      { type: 'tip', text: 'Thể sai khiến chủ động: have somebody do something (I had the technician check my laptop) / get somebody to do something (I got my brother to fix it).' },
      { type: 'mistake', wrong: 'I cut my hair yesterday. (ý: đi cắt ở tiệm)', right: 'I had my hair cut yesterday.', why: 'Khi người khác làm cho bạn, dùng have/get + O + V3. "I cut my hair" nghĩa là tự cắt.' },
      { type: 'mistake', wrong: 'He is said that he is a genius.', right: 'It is said that he is a genius. / He is said to be a genius.', why: 'Không trộn hai cấu trúc: hoặc It … that, hoặc S … to V.' },
      { type: 'mistake', wrong: 'The castle is believed to built in 1200.', right: 'The castle is believed to have been built in 1200.', why: 'Sự việc ở quá khứ và lâu đài bị xây → to have been V3.' },
      { type: 'ielts', text: 'Task 2: It is often argued / It is widely believed that… là cách mở bài và nêu quan điểm đối lập rất tự nhiên. Speaking Part 3: dùng is thought to / is said to để nói về xu hướng chung mà không cần dẫn nguồn.', ex: 'It is commonly claimed that social media isolates young people, yet it is also known to help them find supportive communities.' }
    ],
    quiz: [
      { q: '___ that the new policy will reduce traffic congestion.', options: ['It is expected', 'It expects', 'They are expected', 'Is expected'], answer: 0, explain: 'Cấu trúc It + be + V3 + that…' },
      { q: 'The Great Wall is said ___ visible from space, but this is a myth.', options: ['being', 'to be', 'that it is', 'be'], answer: 1, explain: 'S + be said + to V (cùng thời điểm).' },
      { q: 'The pyramid is thought ___ over 4,000 years ago.', options: ['to build', 'to be built', 'to have been built', 'having built'], answer: 2, explain: 'Xảy ra trong quá khứ + bị động → to have been V3.' },
      { q: 'I need to ___ before the trip.', options: ['have my car serviced', 'have serviced my car', 'have my car service', 'get serviced my car'], answer: 0, explain: 'Have + O + V3.' },
      { q: 'She ___ her phone stolen at the airport.', options: ['got', 'made', 'let', 'was'], answer: 0, explain: 'Get/have + O + V3 cũng diễn tả việc không may xảy ra với mình.' },
      { q: 'Chọn câu ĐÚNG.', options: ['He is known that he is honest.', 'It is known to be honest.', 'He is known to be honest.', 'He knows to be honest.'], answer: 2, explain: 'S + is known + to V là cấu trúc đúng.' }
    ]
  });

  /* 6. Conditionals type 0 & 1 */
  G.push({
    id: 'conditionals-0-1', unit: 'verbs', order: 6,
    title: 'Câu điều kiện loại 0 và loại 1', en: 'Zero & First Conditionals', level: 'A2', emoji: '🔁',
    summary: 'Loại 0 diễn tả sự thật luôn đúng; loại 1 diễn tả điều kiện có thật và kết quả có khả năng xảy ra trong tương lai.',
    blocks: [
      { type: 'diagram', caption: 'Mệnh đề điều kiện → kết quả', steps: [
        { t: 'If you heat ice, it melts.', c: 'if' },
        { t: 'Loại 0: hiện tại đơn → hiện tại đơn (luôn đúng)', c: 'note' },
        { t: '↓', c: 'arrow' },
        { t: 'If it rains tomorrow, the match will be cancelled.', c: 'if' },
        { t: 'Loại 1: hiện tại đơn → will + V (có thể xảy ra)', c: 'result' }
      ] },
      { type: 'formula', rows: [
        { label: 'Loại 0', parts: [ { t: 'If', c: 'adv' }, { t: 'S + V (hiện tại)', c: 'subj' }, { t: ',', c: 'adv' }, { t: 'S + V (hiện tại)', c: 'verb' } ], ex: 'If people don\'t sleep enough, their memory suffers.' },
        { label: 'Loại 1', parts: [ { t: 'If', c: 'adv' }, { t: 'S + V (hiện tại)', c: 'subj' }, { t: ',', c: 'adv' }, { t: 'S + will/can/may', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'If you revise every day, you will feel more confident.' },
        { label: 'Loại 1 + mệnh lệnh', parts: [ { t: 'If', c: 'adv' }, { t: 'S + V (hiện tại)', c: 'subj' }, { t: ',', c: 'adv' }, { t: 'V (mệnh lệnh)', c: 'verb' } ], ex: 'If you finish early, check your answers.' }
      ] },
      { type: 'uses', items: [
        { title: 'Loại 0: sự thật khoa học, quy luật', ex: 'If water reaches 100°C, it boils.', vi: 'Nếu nước đạt 100°C, nó sôi.' },
        { title: 'Loại 0: thói quen, điều luôn xảy ra', ex: 'If I drink coffee after 4 p.m., I can\'t sleep.', vi: 'Nếu tôi uống cà phê sau 4 giờ chiều, tôi không ngủ được.' },
        { title: 'Loại 1: dự đoán có cơ sở', ex: 'If the government raises taxes, consumers will spend less.', vi: 'Nếu chính phủ tăng thuế, người tiêu dùng sẽ chi tiêu ít hơn.' },
        { title: 'Loại 1: lời hứa, cảnh báo, đe dọa', ex: 'If you miss another deadline, you will lose the scholarship.', vi: 'Nếu bạn trễ hạn thêm lần nữa, bạn sẽ mất học bổng.' },
        { title: 'When vs If: when = chắc chắn sẽ xảy ra', ex: 'When I get my results, I\'ll call you.', vi: 'Khi nào có kết quả, tôi sẽ gọi cho bạn (chắc chắn sẽ có).' }
      ] },
      { type: 'table', head: ['Loại', 'Mệnh đề If', 'Mệnh đề chính', 'Ý nghĩa'], rows: [
        ['0', 'Hiện tại đơn', 'Hiện tại đơn', 'Luôn đúng'],
        ['1', 'Hiện tại đơn / hiện tại tiếp diễn / HTHT', 'will / can / may / might + V', 'Có thể xảy ra trong tương lai'],
        ['1 (lịch sự)', 'should + V (đảo ngữ: Should you…)', 'please + V', 'Trang trọng, ít khả năng hơn']
      ] },
      { type: 'tip', text: 'Không dùng will trong mệnh đề if (và sau when, as soon as, before, until khi nói về tương lai): As soon as I arrive, I will text you.' },
      { type: 'tip', text: 'Khi mệnh đề if đứng đầu thì có dấu phẩy; khi đứng sau thì thường không: The match will be cancelled if it rains.' },
      { type: 'mistake', wrong: 'If it will rain tomorrow, we will stay home.', right: 'If it rains tomorrow, we will stay home.', why: 'Mệnh đề if dùng hiện tại đơn dù nói về tương lai – người Việt hay thêm will vì có chữ "ngày mai".' },
      { type: 'mistake', wrong: 'If you will heat metal, it expands.', right: 'If you heat metal, it expands.', why: 'Sự thật khoa học → loại 0, cả hai vế hiện tại đơn.' },
      { type: 'ielts', text: 'Task 2: dùng loại 1 để trình bày hệ quả của một chính sách hoặc giải pháp. Speaking Part 3: dùng loại 0 để nói về xu hướng chung trong xã hội.', ex: 'If governments subsidise public transport, fewer people will rely on private cars, and air quality will improve.' }
    ],
    quiz: [
      { q: 'If you mix red and blue, you ___ purple.', options: ['got', 'will got', 'get', 'would get'], answer: 2, explain: 'Sự thật luôn đúng → loại 0, hiện tại đơn.' },
      { q: 'If she ___ hard, she will pass the exam.', options: ['studies', 'will study', 'studied', 'would study'], answer: 0, explain: 'Mệnh đề if loại 1 dùng hiện tại đơn.' },
      { q: 'If the price of fuel rises, airlines ___ their fares.', options: ['increased', 'will increase', 'would have increased', 'increasing'], answer: 1, explain: 'Kết quả có thể xảy ra → will + V.' },
      { q: 'I\'ll lend you my book as soon as I ___ it.', options: ['will finish', 'finish', 'would finish', 'finished'], answer: 1, explain: 'Sau as soon as (tương lai) dùng hiện tại đơn.' },
      { q: '___ you need any help, please contact the reception.', options: ['Should', 'Would', 'Will', 'Had'], answer: 0, explain: 'Đảo ngữ loại 1 trang trọng: Should you need… = If you need…' },
      { q: 'If plants don\'t get enough light, they ___.', options: ['will died', 'die', 'would die', 'had died'], answer: 1, explain: 'Quy luật tự nhiên → loại 0.' }
    ]
  });

  /* 7. Conditionals type 2 & 3 */
  G.push({
    id: 'conditionals-2-3', unit: 'verbs', order: 7,
    title: 'Câu điều kiện loại 2 và loại 3', en: 'Second & Third Conditionals', level: 'B1', emoji: '💭',
    summary: 'Loại 2 nói về tình huống giả định, không có thật ở hiện tại/tương lai; loại 3 nói về quá khứ không có thật và kết quả tưởng tượng.',
    blocks: [
      { type: 'diagram', caption: 'Lùi thì để thể hiện sự "không có thật"', steps: [
        { t: 'Thực tế: I don\'t have enough money, so I can\'t travel.', c: 'note' },
        { t: '↓ Loại 2: lùi một thì (hiện tại → quá khứ)', c: 'arrow' },
        { t: 'If I had enough money, I would travel the world.', c: 'if' },
        { t: 'Thực tế: I didn\'t revise, so I failed.', c: 'note' },
        { t: '↓ Loại 3: lùi về quá khứ hoàn thành', c: 'arrow' },
        { t: 'If I had revised, I would have passed.', c: 'result' }
      ] },
      { type: 'formula', rows: [
        { label: 'Loại 2', parts: [ { t: 'If', c: 'adv' }, { t: 'S + V2/were', c: 'subj' }, { t: ',', c: 'adv' }, { t: 'S + would/could/might', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'If public transport were free, more people would use it.' },
        { label: 'Loại 3', parts: [ { t: 'If', c: 'adv' }, { t: 'S + had V3', c: 'subj' }, { t: ',', c: 'adv' }, { t: 'S + would/could/might have', c: 'aux' }, { t: 'V3', c: 'verb' } ], ex: 'If the warning had come earlier, fewer people would have been injured.' },
        { label: 'Đảo ngữ', parts: [ { t: 'Were / Had', c: 'aux' }, { t: 'S', c: 'subj' }, { t: '(to V / V3)', c: 'verb' }, { t: ', S + would…', c: 'obj' } ], ex: 'Had I known about the strike, I would have taken a taxi.' }
      ] },
      { type: 'uses', items: [
        { title: 'Loại 2: tình huống trái với hiện tại', ex: 'If I lived closer to the city centre, I wouldn\'t need a car.', vi: 'Nếu tôi sống gần trung tâm hơn, tôi sẽ không cần xe hơi.' },
        { title: 'Loại 2: giả định khó xảy ra ở tương lai', ex: 'If I won the lottery, I would set up a charity.', vi: 'Nếu trúng xổ số, tôi sẽ lập một quỹ từ thiện.' },
        { title: 'Loại 2: lời khuyên (If I were you…)', ex: 'If I were you, I would focus on Writing Task 2.', vi: 'Nếu tôi là bạn, tôi sẽ tập trung vào Writing Task 2.' },
        { title: 'Loại 3: tiếc nuối hoặc phê bình quá khứ', ex: 'If she had applied on time, she would have got the job.', vi: 'Nếu cô ấy nộp hồ sơ đúng hạn thì đã được nhận việc rồi.' },
        { title: 'Loại 3: phân tích nguyên nhân lịch sử', ex: 'If the printing press hadn\'t been invented, knowledge would have spread much more slowly.', vi: 'Nếu máy in không được phát minh, tri thức đã lan truyền chậm hơn nhiều.' }
      ] },
      { type: 'table', head: ['Loại', 'Thời gian', 'Mệnh đề If', 'Mệnh đề chính'], rows: [
        ['2', 'Hiện tại / tương lai (không thật)', 'V2 / were', 'would / could / might + V'],
        ['3', 'Quá khứ (không thật)', 'had + V3', 'would / could / might have + V3'],
        ['Đảo ngữ 2', 'Trang trọng', 'Were S to V… / Were S…', 'would + V'],
        ['Đảo ngữ 3', 'Trang trọng', 'Had S (not) V3…', 'would have + V3']
      ] },
      { type: 'tip', text: 'Trong loại 2, văn trang trọng dùng were cho mọi ngôi: If she were the manager… (was chấp nhận trong văn nói thân mật).' },
      { type: 'tip', text: 'Khi viết tắt, \'d có thể là had hoặc would: If I\'d known (= had), I\'d have helped (= would).' },
      { type: 'mistake', wrong: 'If I would have more time, I would learn French.', right: 'If I had more time, I would learn French.', why: 'Không dùng would trong mệnh đề if.' },
      { type: 'mistake', wrong: 'If I had studied harder, I would pass the exam last year.', right: 'If I had studied harder, I would have passed the exam last year.', why: 'Kết quả ở quá khứ → would have + V3.' },
      { type: 'mistake', wrong: 'If I was you, I will take the course.', right: 'If I were you, I would take the course.', why: 'Lời khuyên giả định → loại 2: were + would. Không trộn will với loại 2.' },
      { type: 'ielts', text: 'Task 2: loại 2 giúp đưa ví dụ giả định thuyết phục (If every household recycled…). Speaking Part 3 câu hỏi kiểu "What would happen if…?" bắt buộc trả lời bằng loại 2. Đảo ngữ (Were…/Had…) giúp tăng điểm Grammatical Range.', ex: 'Were the government to ban single-use plastics, manufacturers would be forced to find greener alternatives.' }
    ],
    quiz: [
      { q: 'If I ___ a car, I would drive to work.', options: ['have', 'had', 'would have', 'had had'], answer: 1, explain: 'Loại 2: If + V2.' },
      { q: 'If they had left earlier, they ___ the flight.', options: ['wouldn\'t miss', 'won\'t miss', 'wouldn\'t have missed', 'didn\'t miss'], answer: 2, explain: 'Loại 3: would have + V3.' },
      { q: 'If I ___ you, I would accept the offer.', options: ['am', 'were', 'had been', 'would be'], answer: 1, explain: 'If I were you – lời khuyên, loại 2.' },
      { q: '___ the doctors acted faster, the patient might have survived.', options: ['If', 'Had', 'Were', 'Should'], answer: 1, explain: 'Đảo ngữ loại 3: Had + S + V3.' },
      { q: 'What would you do if you ___ a wallet in the street?', options: ['find', 'found', 'will find', 'had found'], answer: 1, explain: 'Giả định khó xảy ra → loại 2.' },
      { q: 'If the bridge ___ properly, it wouldn\'t have collapsed.', options: ['was maintained', 'had been maintained', 'would be maintained', 'is maintained'], answer: 1, explain: 'Loại 3 bị động: had been + V3.' }
    ]
  });

  /* 8. Mixed conditionals, unless, wish */
  G.push({
    id: 'mixed-conditionals-wish', unit: 'verbs', order: 8,
    title: 'Điều kiện hỗn hợp, unless & wish', en: 'Mixed Conditionals, Unless & Wish', level: 'B2', emoji: '🌗',
    summary: 'Kết hợp quá khứ – hiện tại trong câu điều kiện hỗn hợp; dùng unless, provided that, as long as thay cho if; và wish / if only để diễn tả mong ước, hối tiếc.',
    blocks: [
      { type: 'diagram', caption: 'Điều kiện hỗn hợp: nguyên nhân quá khứ → hệ quả hiện tại', steps: [
        { t: 'Thực tế: I didn\'t learn to swim as a child, so I\'m afraid of water now.', c: 'note' },
        { t: 'If I had learnt to swim as a child,', c: 'if' },
        { t: '↓ had V3 (quá khứ) → would V (hiện tại)', c: 'arrow' },
        { t: 'I wouldn\'t be afraid of water now.', c: 'result' }
      ] },
      { type: 'formula', rows: [
        { label: 'Hỗn hợp 3 → 2', parts: [ { t: 'If S + had V3', c: 'subj' }, { t: ', S + would', c: 'aux' }, { t: 'V', c: 'verb' }, { t: '(now)', c: 'time' } ], ex: 'If she had taken that job, she would be living in Singapore now.' },
        { label: 'Hỗn hợp 2 → 3', parts: [ { t: 'If S + V2', c: 'subj' }, { t: ', S + would have', c: 'aux' }, { t: 'V3', c: 'verb' } ], ex: 'If he were more organised, he wouldn\'t have lost the documents.' },
        { label: 'Unless', parts: [ { t: 'Unless', c: 'neg' }, { t: 'S + V (khẳng định)', c: 'subj' }, { t: ', S + will', c: 'aux' }, { t: 'V', c: 'verb' } ], ex: 'Unless we act now, many species will disappear.' },
        { label: 'Wish (hiện tại)', parts: [ { t: 'S', c: 'subj' }, { t: 'wish / If only', c: 'adv' }, { t: 'S + V2 / were', c: 'verb' } ], ex: 'I wish I spoke English more fluently.' },
        { label: 'Wish (quá khứ)', parts: [ { t: 'S', c: 'subj' }, { t: 'wish / If only', c: 'adv' }, { t: 'S + had V3', c: 'verb' } ], ex: 'If only I had started preparing earlier!' }
      ] },
      { type: 'uses', items: [
        { title: 'Unless = if … not', ex: 'You won\'t get a high score unless you manage your time well.', vi: 'Bạn sẽ không đạt điểm cao trừ khi biết quản lý thời gian tốt.' },
        { title: 'Provided (that) / as long as / on condition that: với điều kiện là', ex: 'You can use the lab as long as you follow the safety rules.', vi: 'Bạn có thể dùng phòng thí nghiệm miễn là tuân thủ quy tắc an toàn.' },
        { title: 'Wish + V2: mong điều trái với hiện tại', ex: 'Many workers wish they had more flexible hours.', vi: 'Nhiều người lao động ước họ có giờ làm linh hoạt hơn.' },
        { title: 'Wish + had V3: hối tiếc về quá khứ', ex: 'I wish I hadn\'t chosen such a difficult topic.', vi: 'Tôi ước mình đã không chọn một đề tài khó như vậy.' },
        { title: 'Wish + would: phàn nàn về hành vi người khác / mong thay đổi', ex: 'I wish my neighbours would stop playing loud music.', vi: 'Tôi ước hàng xóm thôi bật nhạc to.' }
      ] },
      { type: 'table', head: ['Cấu trúc', 'Thời điểm', 'Ví dụ'], rows: [
        ['wish + V2 / were', 'Hiện tại', 'I wish I were taller.'],
        ['wish + had V3', 'Quá khứ', 'I wish I had listened to my teacher.'],
        ['wish + would V', 'Tương lai / phàn nàn', 'I wish it would stop raining.'],
        ['wish + could V', 'Khả năng', 'I wish I could play the guitar.'],
        ['If only…', 'Giống wish nhưng mạnh hơn', 'If only we had more time!']
      ] },
      { type: 'tip', text: 'Không dùng wish + would cho chính mình (I wish I would…). Muốn nói về khả năng của bản thân, dùng wish I could.' },
      { type: 'tip', text: 'Muốn mong một điều có khả năng xảy ra trong tương lai thì dùng hope, không dùng wish: I hope you pass the test.' },
      { type: 'mistake', wrong: 'Unless you don\'t hurry, you will be late.', right: 'Unless you hurry, you will be late.', why: 'Unless đã mang nghĩa phủ định (= if not); thêm don\'t thành phủ định kép.' },
      { type: 'mistake', wrong: 'I wish I can speak Japanese.', right: 'I wish I could speak Japanese.', why: 'Sau wish phải lùi thì: can → could.' },
      { type: 'mistake', wrong: 'I wish you will pass the exam.', right: 'I hope you pass / will pass the exam.', why: 'Chúc ai điều có thể xảy ra → hope. Lỗi do dịch "chúc/mong" thành wish.' },
      { type: 'ielts', text: 'Speaking Part 2 (kể chuyện quá khứ) và Part 1 (hỏi về hối tiếc, mong muốn) là nơi lý tưởng để dùng wish / if only và điều kiện hỗn hợp. Task 2: provided that / as long as giúp đưa điều kiện cho lập luận một cách tinh tế.', ex: 'Technology benefits students, provided that it is used to support rather than replace face-to-face teaching.' }
    ],
    quiz: [
      { q: 'If I had saved money last year, I ___ able to buy a laptop now.', options: ['would be', 'would have been', 'will be', 'had been'], answer: 0, explain: 'Hỗn hợp: điều kiện quá khứ → kết quả hiện tại (now) → would + V.' },
      { q: '___ you apply before Friday, you won\'t be considered.', options: ['If', 'Unless', 'Provided', 'As long as'], answer: 1, explain: 'Unless = if not: nếu không nộp trước thứ Sáu.' },
      { q: 'I wish I ___ more time to prepare for the interview yesterday.', options: ['have', 'had', 'had had', 'would have'], answer: 2, explain: 'Hối tiếc về quá khứ → wish + had V3 (had had).' },
      { q: 'You can borrow my notes ___ you return them tomorrow.', options: ['unless', 'as long as', 'even if', 'in case'], answer: 1, explain: 'As long as = miễn là (điều kiện).' },
      { q: 'I wish my brother ___ borrowing my things without asking.', options: ['stops', 'would stop', 'stopped had', 'will stop'], answer: 1, explain: 'Phàn nàn về hành vi người khác → wish + would.' },
      { q: 'If he weren\'t so shy, he ___ to the party last night.', options: ['would go', 'will go', 'would have gone', 'had gone'], answer: 2, explain: 'Hỗn hợp: tính cách hiện tại (V2) → kết quả quá khứ (would have V3).' }
    ]
  });

  /* 9. Reported speech */
  G.push({
    id: 'reported-speech', unit: 'verbs', order: 9,
    title: 'Câu tường thuật', en: 'Reported Speech', level: 'B1', emoji: '🗣️',
    summary: 'Chuyển lời nói trực tiếp sang gián tiếp bằng cách lùi thì, đổi đại từ, trạng từ thời gian – nơi chốn và chọn động từ tường thuật phù hợp.',
    blocks: [
      { type: 'diagram', caption: 'Từ lời nói trực tiếp sang gián tiếp', steps: [
        { t: '"I am preparing for my test this week," Linh said.', c: 'active' },
        { t: '↓ bỏ ngoặc kép, đổi I → she', c: 'arrow' },
        { t: '↓ lùi thì: am preparing → was preparing', c: 'arrow' },
        { t: '↓ đổi trạng từ: this week → that week', c: 'arrow' },
        { t: 'Linh said (that) she was preparing for her test that week.', c: 'passive' }
      ] },
      { type: 'formula', rows: [
        { label: 'Câu kể', parts: [ { t: 'S', c: 'subj' }, { t: 'said / told sb', c: 'verb' }, { t: '(that)', c: 'adv' }, { t: 'S + V (lùi thì)', c: 'obj' } ], ex: 'He told me (that) he had lost his passport.' },
        { label: 'Câu hỏi Yes/No', parts: [ { t: 'S', c: 'subj' }, { t: 'asked', c: 'verb' }, { t: 'if / whether', c: 'adv' }, { t: 'S + V (lùi thì)', c: 'obj' } ], ex: 'The examiner asked if I enjoyed reading.' },
        { label: 'Câu hỏi Wh-', parts: [ { t: 'S', c: 'subj' }, { t: 'asked', c: 'verb' }, { t: 'Wh-', c: 'adv' }, { t: 'S + V (không đảo)', c: 'obj' } ], ex: 'She asked me where I lived.' },
        { label: 'Mệnh lệnh / yêu cầu', parts: [ { t: 'S', c: 'subj' }, { t: 'told / asked', c: 'verb' }, { t: 'sb', c: 'obj' }, { t: '(not) to V', c: 'verb' } ], ex: 'The teacher told us not to use our phones.' }
      ] },
      { type: 'uses', items: [
        { title: 'Lùi thì khi động từ tường thuật ở quá khứ', ex: 'She said she would call me later.', vi: 'Cô ấy nói sẽ gọi cho tôi sau.' },
        { title: 'Không cần lùi thì khi điều đó vẫn còn đúng', ex: 'Our lecturer said that the Earth orbits the Sun.', vi: 'Giảng viên nói rằng Trái Đất quay quanh Mặt Trời.' },
        { title: 'Động từ tường thuật + to V: promise, agree, refuse, offer', ex: 'The company promised to reduce its plastic packaging.', vi: 'Công ty hứa sẽ giảm bao bì nhựa.' },
        { title: 'Động từ + sb + to V: advise, warn, remind, encourage', ex: 'My tutor advised me to read more academic articles.', vi: 'Gia sư khuyên tôi đọc nhiều bài báo học thuật hơn.' },
        { title: 'Động từ + V-ing: admit, deny, suggest, recommend', ex: 'The minister denied taking any bribes.', vi: 'Bộ trưởng phủ nhận đã nhận hối lộ.' }
      ] },
      { type: 'table', head: ['Trực tiếp', 'Gián tiếp'], rows: [
        ['Hiện tại đơn (do)', 'Quá khứ đơn (did)'],
        ['Hiện tại tiếp diễn (am doing)', 'Quá khứ tiếp diễn (was doing)'],
        ['Hiện tại hoàn thành / Quá khứ đơn', 'Quá khứ hoàn thành (had done)'],
        ['will / can / may', 'would / could / might'],
        ['must', 'had to (hoặc giữ must)'],
        ['now / today / tomorrow', 'then / that day / the next day'],
        ['yesterday / ago / here', 'the day before / before / there']
      ] },
      { type: 'tip', text: 'Say không có tân ngữ người trực tiếp (said to me), còn tell bắt buộc có: told me. Không viết "said me" hay "told that".' },
      { type: 'tip', text: 'Suggest không đi với to V: He suggested going / He suggested that we (should) go.' },
      { type: 'mistake', wrong: 'She asked me where did I live.', right: 'She asked me where I lived.', why: 'Câu hỏi gián tiếp dùng trật tự câu kể (S + V), không đảo trợ động từ.' },
      { type: 'mistake', wrong: 'He said me that he was tired.', right: 'He told me that he was tired. / He said that he was tired.', why: 'Say không đi trực tiếp với tân ngữ người.' },
      { type: 'mistake', wrong: 'My friend suggested me to take a gap year.', right: 'My friend suggested (that) I take / taking a gap year.', why: 'Suggest không theo mẫu suggest sb to V.' },
      { type: 'ielts', text: 'Writing Task 2: dùng động từ tường thuật đa dạng (claim, argue, suggest, point out, maintain) thay vì chỉ say để trình bày quan điểm của người khác. Speaking Part 2: kể lại lời khuyên ai đó từng nói với bạn.', ex: 'Some experts argue that homework should be abolished, while others maintain that it builds discipline.' }
    ],
    quiz: [
      { q: '"I am tired," she said. → She said that she ___ tired.', options: ['is', 'was', 'has been', 'will be'], answer: 1, explain: 'Lùi thì: am → was.' },
      { q: '"Where do you work?" he asked. → He asked me where I ___.', options: ['do work', 'did work', 'worked', 'work did'], answer: 2, explain: 'Lùi thì và không đảo: where I worked.' },
      { q: '"Don\'t touch the screen," the guide said. → The guide told us ___ the screen.', options: ['don\'t touch', 'not to touch', 'to not touching', 'not touch'], answer: 1, explain: 'Mệnh lệnh phủ định → told sb not to V.' },
      { q: '"I will help you tomorrow," he said. → He said he ___ help me ___.', options: ['will / tomorrow', 'would / the next day', 'would / yesterday', 'will / the next day'], answer: 1, explain: 'will → would; tomorrow → the next day.' },
      { q: 'She ___ breaking the vase.', options: ['denied', 'refused', 'promised', 'told'], answer: 0, explain: 'Deny + V-ing (phủ nhận đã làm).' },
      { q: '"Can you swim?" she asked. → She asked ___ I could swim.', options: ['that', 'what', 'if', 'did'], answer: 2, explain: 'Câu hỏi Yes/No → if/whether.' }
    ]
  });

  /* 10. Gerund vs to-infinitive */
  G.push({
    id: 'gerund-infinitive', unit: 'verbs', order: 10,
    title: 'Danh động từ và động từ nguyên mẫu có to', en: 'Gerund vs To-infinitive', level: 'B1', emoji: '⚖️',
    summary: 'Một số động từ đi với V-ing, số khác đi với to V, và một nhóm (stop, remember, forget, try, regret) đổi nghĩa tùy theo dạng theo sau.',
    blocks: [
      { type: 'diagram', caption: 'Cùng động từ, khác nghĩa: stop', steps: [
        { t: 'He stopped smoking.', c: 'if' },
        { t: '→ ngừng hẳn thói quen hút thuốc (V-ing = hành động bị dừng)', c: 'note' },
        { t: '↓ so sánh', c: 'arrow' },
        { t: 'He stopped to smoke.', c: 'result' },
        { t: '→ dừng việc khác lại để hút thuốc (to V = mục đích)', c: 'note' }
      ] },
      { type: 'formula', rows: [
        { label: 'Động từ + V-ing', parts: [ { t: 'S', c: 'subj' }, { t: 'enjoy/avoid/finish…', c: 'verb' }, { t: 'V-ing', c: 'obj' } ], ex: 'Many students avoid speaking in class.' },
        { label: 'Động từ + to V', parts: [ { t: 'S', c: 'subj' }, { t: 'decide/hope/plan…', c: 'verb' }, { t: 'to V', c: 'obj' } ], ex: 'She decided to study abroad.' },
        { label: 'Giới từ + V-ing', parts: [ { t: 'S', c: 'subj' }, { t: 'be interested in / look forward to', c: 'verb' }, { t: 'V-ing', c: 'obj' } ], ex: 'I look forward to hearing from you.' },
        { label: 'V-ing làm chủ ngữ', parts: [ { t: 'V-ing', c: 'subj' }, { t: 'is/helps…', c: 'verb' }, { t: '…', c: 'obj' } ], ex: 'Reading widely improves your vocabulary.' }
      ] },
      { type: 'uses', items: [
        { title: 'Remember / forget + to V: nhớ/quên phải làm (việc chưa làm)', ex: 'Remember to write at least 250 words.', vi: 'Nhớ viết ít nhất 250 từ.' },
        { title: 'Remember / forget + V-ing: nhớ/quên đã làm (việc đã xảy ra)', ex: 'I remember visiting Ha Long Bay as a child.', vi: 'Tôi nhớ đã đến Vịnh Hạ Long hồi nhỏ.' },
        { title: 'Try + to V: cố gắng; try + V-ing: thử làm xem sao', ex: 'I tried to sleep, but the noise was too loud. / Try drinking warm milk before bed.', vi: 'Tôi cố ngủ nhưng ồn quá. / Thử uống sữa ấm trước khi ngủ xem.' },
        { title: 'Regret + V-ing: hối tiếc đã làm; regret + to V: lấy làm tiếc phải báo', ex: 'We regret to inform you that your application was unsuccessful.', vi: 'Chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn không được chấp nhận.' },
        { title: 'Like / love / hate / prefer / begin / start: cả hai, nghĩa gần như nhau', ex: 'It started raining / to rain just after we left.', vi: 'Trời bắt đầu mưa ngay sau khi chúng tôi rời đi.' }
      ] },
      { type: 'table', head: ['+ V-ing', '+ to V', 'Cả hai (đổi nghĩa)'], rows: [
        ['enjoy, avoid, finish, mind, consider', 'decide, hope, plan, agree, refuse', 'stop, remember, forget'],
        ['suggest, recommend, deny, admit, risk', 'manage, afford, offer, promise, fail', 'try, regret'],
        ['keep, practise, delay, postpone, miss', 'expect, want, would like, tend, seem', 'go on, mean, need'],
        ['can\'t help, can\'t stand, it\'s worth', 'learn, aim, attempt, intend', '—']
      ] },
      { type: 'tip', text: 'Sau giới từ luôn dùng V-ing – kể cả "to" là giới từ trong look forward to, be used to, object to, when it comes to, contribute to: This contributes to reducing pollution.' },
      { type: 'tip', text: 'Need + V-ing mang nghĩa bị động: The roof needs repairing (= needs to be repaired).' },
      { type: 'mistake', wrong: 'I look forward to meet you.', right: 'I look forward to meeting you.', why: 'To trong look forward to là giới từ → V-ing. Lỗi rất phổ biến trong thư IELTS General Task 1.' },
      { type: 'mistake', wrong: 'Students should avoid to use informal language.', right: 'Students should avoid using informal language.', why: 'Avoid luôn đi với V-ing.' },
      { type: 'mistake', wrong: 'I forgot locking the door, so a thief got in.', right: 'I forgot to lock the door, so a thief got in.', why: 'Quên làm việc cần làm → forget + to V.' },
      { type: 'ielts', text: 'Task 2: dùng V-ing làm chủ ngữ để câu súc tích, học thuật (Investing in education…). Kết hợp các động từ như tend to, fail to, be worth V-ing, contribute to V-ing để tăng độ đa dạng ngữ pháp.', ex: 'Encouraging children to read for pleasure is worth prioritising, as it tends to improve their academic performance.' }
    ],
    quiz: [
      { q: 'Most candidates want ___ a band 7 or higher.', options: ['achieving', 'to achieve', 'achieve', 'achieved'], answer: 1, explain: 'Want + to V.' },
      { q: 'Would you mind ___ the window?', options: ['to open', 'open', 'opening', 'opened'], answer: 2, explain: 'Mind + V-ing.' },
      { q: 'On the way home, I stopped ___ some bread.', options: ['buying', 'to buy', 'buy', 'bought'], answer: 1, explain: 'Dừng lại để mua (mục đích) → stop to V.' },
      { q: 'I don\'t remember ___ this film before, but the ending seems familiar.', options: ['to watch', 'watching', 'watch', 'to have watch'], answer: 1, explain: 'Nhớ (không nhớ) việc đã làm → remember + V-ing.' },
      { q: 'If you can\'t sleep, try ___ a book instead of using your phone.', options: ['reading', 'to read', 'read', 'reads'], answer: 0, explain: 'Thử làm một cách để xem có hiệu quả không → try + V-ing.' },
      { q: 'Scientists are committed to ___ a cure for the disease.', options: ['find', 'finding', 'found', 'to finding a'], answer: 1, explain: 'Be committed to: to là giới từ → V-ing.' }
    ]
  });
})(typeof self !== 'undefined' ? self : this);
