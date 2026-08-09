# Ontology Page Guide

## Cập nhật: progressive graph cho ontology lớn

- `/` và `/ontology` mở Ontology Explorer; `/mermaid` mở Mermaid viewer.
- Registry vẫn lazy-load từng file và giữ `all.ontology.json` làm nguồn mặc định.
- Converter xây full index gồm element lookup, adjacency, subclass children và root class. Full index dùng cho search, detail và traversal; không truyền toàn bộ graph vào Cytoscape.
- Canvas dùng projection có budget tối đa **350 nodes / 700 edges**:
  - `overview`: root class và hai tầng subclass con;
  - `focus`: concept được chọn và neighborhood theo depth;
  - property chỉ materialize khi filter Properties được bật.
- Khi đạt budget, UI dừng mở rộng và yêu cầu focus concept hoặc refine filter. `Show all` đã được thay bằng `Back to overview`, `Expand view` và `Reset visibility`.
- Cytoscape được dynamic-import sau page shell, core chỉ tạo một lần cho mỗi dataset và projection được cập nhật bằng `cy.batch()` add/remove diff.
- Layout tự động là directed `breadthfirst` cho hierarchy, `grid` cho graph không có subclass. CoSE chỉ được phép khi target có tối đa 150 nodes.
- Performance marks: `ontology:data-load`, `ontology:model-build`, `ontology:layout`.
- Quality gates: `npm run quality`, `npm run test:e2e`, và `npx lhci autorun`. Bundle budget là 225 KB gzip cho JS Ontology và 350 KB gzip cho default ontology chunk.

## 1. Mục đích

Ontology Page là một workspace để đọc, lọc và khám phá ontology dưới dạng graph tương tác. Trang dùng Cytoscape.js để hiển thị class, relationship, subclass và property mà không thay đổi JSON nguồn.

## 2. URL truy cập

- `/ontology` và mọi path con như `/ontology/loan/commercial` mở Ontology Explorer.
- `/mermaid` và mọi path con tiếp tục mở Mermaid viewer.
- `/` giữ tương thích ngược và mở Mermaid viewer.
- Segment đầu tiên không hợp lệ hiển thị trang Not Found.

Khi deploy static build, web server phải rewrite các URL SPA về `index.html`; nếu không, truy cập trực tiếp một nested URL có thể trả về 404 trước khi React chạy.

## 3. Kiến trúc tổng thể

Luồng xử lý chính:

```text
ontology registry
  → parseOntologyJson(raw JSON)
  → OntologyDocument
  → convertToCytoscapeElements()
  → CytoscapeGraphModel
  → OntologyExplorer
  → một Cytoscape instance
```

Router chỉ dựa vào segment đầu tiên và lazy-load từng page. Ontology code được chia thành data source, parser/types, converter, graph controller, controls và detail UI. Cytoscape style nằm trong một module riêng.

## 4. Chuyển JSON thành Cytoscape elements

`parseOntologyJson()` kiểm tra root object, chuẩn hóa các collection và giữ lại metadata chưa biết. `convertToCytoscapeElements()` trả về:

- `elements`: node/edge definitions cho Cytoscape.
- `nodeIndex` và `edgeIndex`: tra metadata nhanh theo ID.
- `propertiesByNodeId`: property gắn với từng class/domain.
- `facets`: node type, edge type, namespace và ontology group cho filter.
- `diagnostics`: external references, property không có domain và relationship thiếu endpoint.

ID ưu tiên `iri`, sau đó `technicalName`, `localName`, `name`; ID được prefix theo loại và tự thêm suffix khi trùng.

## 5. Node/Class

Mỗi phần tử trong `classes` tạo một node `CLASS`, scope `internal`. Node giữ name, label, localName, technicalName, IRI, definition, parents, rules và metadata nguồn. Alias index dùng cả năm trường định danh để resolve relationship.

Reference không resolve được trong file hiện tại tạo một node `EXTERNAL`. Điều này cho phép graph hiển thị quan hệ đi ra ontology khác thay vì crash hoặc bỏ mất endpoint.

## 6. Edge/Relationship

Mỗi relationship có đủ domain và range tạo một edge cho từng cặp domain × range. Edge giữ label, technicalName, definition, domain, range, source, target và `ONTOLOGY_RELATIONSHIP`.

Nếu domain/range tham chiếu class ngoài file, converter tạo external node. Nếu một phía hoàn toàn bị thiếu, Cytoscape edge không được tạo vì sẽ không hợp lệ; record vẫn nằm trong `diagnostics.unresolvedRelationships` và UI hiển thị cảnh báo.

## 7. Property

Property luôn xuất hiện trong detail panel của class theo domain. Converter đồng thời tạo `PROPERTY` node và `HAS_PROPERTY` edge để có thể trực quan hóa, nhưng các element này bị ẩn mặc định nhằm giảm nhiễu.

Bật **Properties** trong Visibility để hiện property trên graph. Property thiếu domain vẫn được giữ như property node và được ghi vào diagnostics; range trống được hiển thị là `—`.

## 8. Parent và subclass

Mỗi giá trị trong `parents` tạo một edge `SUBCLASS_OF` từ class con tới parent. Parent ngoài file trở thành external node. Parent relations có toggle tổng riêng và `SUBCLASS_OF` cũng là một edge-type facet, vì vậy có thể tắt theo cả category lẫn type.

## 9. Tính năng giao diện

- Zoom, pan, drag node, fit, center, reset viewport.
- Single-select, multi-select và box selection.
- Khi canvas có focus: phím mũi tên duyệt cả node/edge, Shift + mũi tên thêm multi-selection, Escape xóa selection.
- Semantic lens làm nổi selected element, related edges và neighbors; các phần khác bị dim.
- Focus, hide selected, isolate, show one-hop, expand neighborhood, hide neighbors và restore hidden.
- Search result có thể reveal một node đang bị ẩn rồi focus/center nó.
- Detail panel hỗ trợ node, edge và multi-selection summary.
- Trên màn hình hẹp, Filters và Details là hai panel có thể mở/đóng độc lập.

## 10. Search

Search là case-insensitive substring search trên `name`, `label`, `localName`, `technicalName` và `iri`. Khi có nhiều kết quả, chọn một item trong danh sách. Node sẽ được reveal tạm thời, selected và đưa vào giữa viewport.

Reveal tạm được xóa khi query/filter thay đổi. Manual Hide có ưu tiên cao hơn reveal, vì vậy người dùng luôn có thể ẩn lại kết quả đã focus.

Command parser như `show neighbors Loan` chưa có trong v1. Logic matching nằm trong module riêng để có thể thêm grammar mà không thay Cytoscape canvas.

## 11. Filter

Panel hỗ trợ:

- Node, edge, property và parent visibility.
- Internal/external scope lấy từ dynamic `scopes` facet.
- Từng node type và edge type.
- Namespace và ontology group.
- Label, technical name, domain và range.

Text filter domain/range áp dụng cho edge; label/technical name áp dụng theo loại element. Facet được sinh từ graph model, không hard-code theo CommercialLoans.

## 12. Hide và show

Filter visibility, manual hidden IDs, isolate set và search reveal set là các lớp trạng thái riêng. Mỗi lần thay đổi, graph controller dùng `cy.batch()` và đổi `display` trên collection hiện có; graph không bị phá và dựng lại.

- **Hide** thêm selected IDs vào manual hidden set.
- **Isolate** chỉ giữ selection đang chọn.
- **1-hop/Expand** reveal neighborhood cấp 1 hoặc 2.
- **Hide neighbors** giữ selection nhưng ẩn neighborhood.
- **Restore hidden** xóa manual/isolate/reveal state, vẫn giữ filter controls.
- **Show all** xóa mọi hidden state/filter và bật cả property graph.
- **Reset** ở filter panel đưa cả filter và visibility về mặc định.

## 13. Layout

Toolbar cung cấp `cose`, `breadthfirst`, `circle`, `concentric` và `grid`. Layout có thể chạy trên toàn graph, phần visible hoặc selection. Tùy chọn **Fit** tự fit collection sau layout. Layout selected sẽ không chạy khi collection có ít hơn hai node.

## 14. Thêm ontology JSON mới

1. Thêm file có suffix `*.ontology.json` vào bất kỳ cấp nào bên trong `data/ontology/`.
2. Khởi động lại Vite dev server nếu file mới chưa xuất hiện qua HMR; production cần build/deploy lại.
3. Không cần import hoặc đăng ký thủ công. Registry dùng `import.meta.glob` để tạo catalog và lazy loader tại build time.
4. Dropdown giữ nguyên relative path và cấu trúc thư mục. Chọn file sẽ lazy-load raw JSON, parse, convert rồi thay Cytoscape model mà không reload trang.

Path đã chọn thành công được lưu tại `localStorage` với key `mermaid.ontology.selectedPath`. Khi path đã lưu không còn tồn tại, page fallback về `all.ontology.json`; nếu không có file này thì dùng entry đầu tiên trong catalog đã sort.

Luồng dữ liệu:

```text
data/ontology/**/*.ontology.json
  → Vite glob registry
  → relative-path folder tree
  → OntologyFileSelector
  → loadOntology(relativePath)
  → parseOntologyJson()
  → convertToCytoscapeElements()
  → remount OntologyExplorer / Cytoscape
```

Mỗi ontology là một lazy chunk riêng. Catalog là snapshot do Vite tạo khi dev server/build khởi động, không phải filesystem browser chạy tại runtime.

## 15. Mở rộng node/edge/property type

- Thêm union value vào `OntologyNodeType` hoặc `OntologyEdgeType`.
- Gán type mới trong converter.
- Thêm selector style tương ứng trong `cytoscapeStyles.ts`.
- Facet/filter UI sẽ tự lấy type từ model.
- Bổ sung test converter cho resolution, metadata và visibility mới.

Không thêm điều kiện style trực tiếp vào React component.

## 16. Limitation hiện tại

- Registry chỉ phát hiện file tại thời điểm Vite scan; thêm file mới có thể cần restart dev server và luôn cần rebuild production.
- Nếu ontology mặc định duy nhất không parse được, page hiển thị startup error vì chưa có graph hợp lệ để giữ lại.
- Relationship thiếu domain hoặc range chỉ nằm trong diagnostics, không thể vẽ thành Cytoscape edge hợp lệ.
- Chưa có command-language parser.
- Cytoscape không tự diễn đạt topology như một semantic HTML tree cho screen reader; keyboard traversal và detail panel là lớp truy cập thay thế hiện tại.
- Chỉ dùng layout built-in; chưa dùng layout extension.

## 17. Hướng tối ưu graph lớn

- Chuyển data source sang fetch/lazy-load theo ontology hoặc neighborhood.
- Thêm incremental `cy.add()` và paging thay vì replace dataset.
- Chạy converter/layout nặng trong Web Worker.
- Dùng level-of-detail: ẩn label ở zoom thấp và chỉ materialize property khi bật.
- Cache alias/provenance index giữa các ontology import.
- Dùng compound nodes hoặc server-side clustering cho ontology group lớn.
- Giữ filter bằng selector/collection/batch như hiện tại để tránh React rerender toàn graph.

## Cập nhật ontology file selector

### File tạo mới

- `src/components/ontology/OntologyFileSelector.tsx`: controlled tree dropdown, folder navigation và active/loading state.
- `src/services/ontology/ontologyTree.ts`: tạo folder tree từ relative paths.
- `src/services/ontology/ontologySelection.ts`: localStorage policy và latest-request guard.
- `src/services/ontology/ontologyRegistry.spec.ts`, `ontologyTree.spec.ts`, `ontologySelection.spec.ts`: registry, hierarchy, fallback/persistence và race tests.

### File sửa

- `OntologyToolbar.tsx`, `OntologyExplorer.tsx`, `OntologyPage.tsx` và `ontology.css`: selector UI, async selection state, error handling và graph remount.
- `ontologyRegistry.ts`: thay fixed import bằng Vite lazy glob registry.
- `convertToCytoscapeElements.spec.ts`: load CommercialLoans bằng path cụ thể thay vì phụ thuộc default source.
- `ONTOLOGY_PAGE_GUIDE.md`: data-flow, cách thêm file và giới hạn bundler.

Không thêm runtime/development dependency và không thay đổi dữ liệu trong `data/ontology/` trong feature này.

### Kết quả kiểm tra selector gần nhất

- `npm run test`: 7 files, 31 tests; 30 pass. Một route test có sẵn vẫn fail vì `/` hiện resolve sang Ontology trong khi test cũ kỳ vọng Mermaid; không thuộc selector feature.
- `npm run lint`: pass.
- `npm run build`: pass; mỗi ontology được phát hành thành lazy chunk riêng, Ontology page code khoảng 11.7 KB gzip và Cytoscape chunk khoảng 137.8 KB gzip.
- Dev server trả HTTP 200 cho `/ontology`.
- Browser tương tác chưa chạy được vì phiên hiện tại không có browser backend; cần chạy smoke checklist expand/select/error/reset trước khi phát hành.
