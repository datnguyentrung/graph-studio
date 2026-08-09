# Hướng dẫn sử dụng Page Ontology

## 1. Page Ontology dùng để làm gì?

Page Ontology giúp bạn mở và đọc các file ontology dưới dạng graph. Trang này dùng để xem các khái niệm, mối quan hệ giữa chúng, property được gán cho từng khái niệm và thông tin chi tiết của từng node hoặc edge.

Nói ngắn gọn: nếu bạn muốn biết trong ontology có những class nào, class này thuộc nhóm nào, có cha/con nào, có property gì và liên quan đến concept nào khác, đây là nơi để xem.

## 2. Bắt đầu sử dụng

Khi mở trang, hệ thống sẽ tự động mở ontology mặc định. Hiện tại file mặc định là `LOAN/all_loan.ontology.json`, trừ khi trình duyệt đã lưu lựa chọn trước đó của bạn.

Để chọn ontology khác, bấm nút `Ontology` trên toolbar. Popup sẽ hiện cây thư mục trong `data/ontology`. Bạn có thể mở hoặc thu gọn folder để tìm file, sau đó bấm vào một file `.ontology.json` để load graph.

Lưu ý: folder chỉ dùng để duyệt danh sách file. Graph chỉ được mở khi bạn chọn một file JSON cụ thể, ví dụ `all.ontology.json` hoặc `LOAN/all_loan.ontology.json`.

Phần đầu trang hiển thị source đang dùng, ontology base và thống kê nhanh: số class, relationship, property và external reference.

## 3. Cách đọc Ontology Graph

Node là một điểm trên graph. Node có thể là class, property hoặc external reference. Class là khái niệm chính trong ontology. Property là thuộc tính gắn với một class. External reference là khái niệm được nhắc đến nhưng nằm ngoài file ontology hiện tại.

Edge là đường nối giữa hai node. Edge cho biết hai node có quan hệ với nhau. Một số loại edge quan trọng:

- `SUBCLASS_OF`: class nguồn là class con hoặc chuyên biệt hơn của class đích.
- `ONTOLOGY_RELATIONSHIP`: quan hệ nghiệp vụ giữa các class.
- `HAS_PROPERTY`: class có property tương ứng.

Quan hệ cha-con của class được đọc qua `SUBCLASS_OF`. Khi graph đang ở chế độ hierarchy, hệ thống sắp xếp để bạn nhìn được cấu trúc từ tổng quát đến chi tiết hơn.

## 4. Các thao tác chính

Chọn một node hoặc edge để xem thông tin chi tiết ở panel bên phải. Với node, panel hiển thị tên, label, technical name, IRI, namespace, parent, properties, rules, incoming và outgoing relationships. Với edge, panel hiển thị source, target, domain, range và loại relationship.

Dùng ô `Search concepts` để tìm node theo name, label, local name, technical name hoặc IRI. Kết quả tìm kiếm lấy từ toàn bộ ontology đã index, kể cả node chưa hiện trên canvas. Bấm vào một kết quả để mở đến node đó và focus nó trên graph.

Bạn có thể ẩn hoặc thu hẹp graph bằng các nút:

- `Hide`: ẩn các phần tử đang chọn.
- `Isolate`: chỉ giữ lại phần tử đang chọn và vùng liên quan trực tiếp.
- `1-hop`: hiện các node/edge liên quan trong 1 bước quanh selection.
- `Hide neighbors`: ẩn các node/edge lân cận của selection.
- `Reset visibility`: bỏ các thao tác ẩn/hiện thủ công và đưa visibility về trạng thái bình thường.

Trên canvas, cuộn chuột để zoom, kéo nền graph để di chuyển, dùng thanh `Zoom` để chỉnh tỉ lệ phóng to. Các nút `Fit graph`, `Center` và `Reset view` giúp đưa graph về lại vùng nhìn dễ đọc hơn.

Bạn cũng có thể dùng bàn phím khi focus đang ở canvas: phím mũi tên để chuyển selection, `Shift + mũi tên` để multi-select, `Esc` để bỏ chọn.

## 5. Toolbar và các chế độ xem

Toolbar gồm những nhóm chức năng chính:

- `Ontology`: chọn file ontology đang xem.
- `Fit graph`, `Center`, `Reset view`: căn lại canvas.
- `Focus`: đưa selection thành vùng xem riêng.
- `Hide`, `Isolate`, `1-hop`, `Hide neighbors`: điều khiển phần graph đang hiển thị.
- `Back to full graph` hoặc `Back to overview`: quay lại chế độ xem mặc định của dataset.
- `Expand view` hoặc `Expand / collapse`: mở rộng vùng đang xem. Với graph lớn, thao tác này dùng để bung hoặc thu gọn node đang chọn.
- `Layout`: chọn cách sắp xếp graph, gồm `Breadthfirst`, `Grid`, `Circle`, `Concentric`, `CoSE`.
- `Target`: chọn layout cho `Current view` hoặc chỉ phần `Selected`.
- `Fit`: tự động căn lại sau khi chạy layout.
- `Run layout`: chạy layout đã chọn.
- `Cancel layout`: dừng layout đang xử lý, thường dùng khi CoSE mất quá lâu.

Chế độ xem hiện tại được hiển thị trong meter trên canvas:

- `Full graph`: render đầy đủ graph của file đang chọn, thường dùng cho ontology nhỏ hoặc vừa.
- `Overview`: chế độ tổng quan cho ontology rất lớn, chỉ hiện root và các domain chính.
- `Hierarchy`: chế độ duyệt dần theo domain, module và class.
- `Focus`: chỉ xem selection và vùng liên quan.

Với dataset nhỏ hoặc vừa, layout mặc định là `CoSE`. Với dataset rất lớn, page sẽ vào progressive view để tránh render mọi thứ cùng lúc.

## 6. Khi graph quá lớn

Với ontology lớn như `all.ontology.json`, việc hiện toàn bộ node và edge cùng lúc sẽ rất rối mắt. Thay vào đó, Page Ontology dùng progressive rendering: toàn bộ dữ liệu vẫn được load và index, nhưng canvas chỉ hiển thị phần đang cần xem.

Bạn sẽ thấy `Overview` với node gốc `FIBO` và các domain chính. Để đi vào trong, double-click vào domain, module hoặc class. Bạn cũng có thể chọn node rồi bấm `Expand / collapse`, hoặc dùng `Enter`/`Space` trên node đang chọn. Double-click lần nữa sẽ thu gọn branch đó.

Khi expand domain, bạn sẽ thấy các module bên trong. Khi expand module, bạn sẽ thấy các class root của module. Khi expand class, bạn sẽ thấy các class con trực tiếp và các edge phân cấp liên quan. Nếu filter `Properties` đang bật, property của các class visible cũng có thể hiện trên graph.

Nút `Relationships` chỉ dùng trong progressive mode và cần có node đang chọn. Nó thêm các quan hệ liên quan trực tiếp đến node đang chọn để bạn xem ngữ cảnh mà không cần bung cả ontology.

Nếu meter báo view đã chạm giới hạn hiển thị, dữ liệu không bị mất. Bạn nên thu gọn branch khác, dùng search để nhảy đến concept cần xem, hoặc dùng `Focus`/`1-hop` để xem một vùng nhỏ hơn.

## 7. Lưu ý

Bộ lọc ở panel trái áp dụng lên graph đang hiển thị. Nếu bạn không thấy node hoặc edge mong đợi, hãy kiểm tra các toggle `Nodes`, `Edges`, `Properties`, `Parent relations`, node type, edge type, namespace và ontology group.

Search có thể tìm node trên toàn bộ ontology, không chỉ node đang hiện trên canvas.

CoSE có thể mất thời gian với graph lớn. Trong lúc processing, graph vẫn có thể dùng được ở layout tạm; nếu cần, bấm `Cancel layout`.

Trong progressive mode, không nên cố xem tất cả node cùng lúc. Cách dùng đúng là xem tổng quan trước, sau đó expand từng nhánh, search concept cần đọc và dùng detail panel để xem thông tin đầy đủ.
