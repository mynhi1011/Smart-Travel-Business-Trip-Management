flowchart TD
    %% Smart Travel & Business Trip Management - User Flow (đã sửa logic rẽ nhánh)

    A["EMPLOYEE<br/>Nhu cầu đi công tác"] --> B["Tạo Trip Request<br/>(Draft)"]
    B --> C["Tạo / Gợi ý Itinerary<br/>• AI gợi ý lịch trình<br/>• Employee điều chỉnh lịch trình"]
    C --> D["Xem & xác nhận Itinerary"]
    D --> E["SYSTEM<br/>Policy Check"]

    E --> F{"Có vi phạm<br/>policy?"}
    %% SỬA: có vi phạm vẫn được gửi duyệt (theo BR-TR-04), chỉ gắn cờ cảnh báo
    %% thay vì bắt buộc loop sửa itinerary trước khi cho gửi
    F -- "Có<br/>(gắn cờ Policy Violation)" --> I["Gửi Request<br/>để phê duyệt<br/>(kèm cờ cảnh báo)"]
    F -- "Không" --> I

    I --> J["MANAGER<br/>Xem chi tiết Request<br/>• Thông tin chuyến đi<br/>• Dự toán chi phí<br/>• Itinerary<br/>• Policy Check"]
    J --> K{"Phê duyệt?"}

    K -- "Reject" --> L["Đóng<br/>Request bị từ chối"]
    K -- "Approve" --> K2{"Ngân sách ≤ 20 triệu<br/>VÀ không vi phạm policy?<br/>(BR-TR-04)"}

    %% SỬA: thêm nhánh rẽ 1 cấp / 2 cấp duyệt sau khi Manager Approve
    K2 -- "Đúng<br/>(chỉ cần 1 cấp)" --> P["Phát hành chuyến đi<br/>(Approved - sẵn sàng khởi hành)"]
    K2 -- "Sai<br/>(> 20 triệu hoặc có vi phạm)" --> M["TRAVEL ADMIN<br/>Kiểm tra chi tiết<br/>& tính khả thi (Cấp 2)"]

    M --> N{"Phê duyệt?"}
    N -- "Reject" --> O["Đóng<br/>Request bị từ chối"]
    N -- "Approve" --> P

    P --> Q["EMPLOYEE<br/>Thực hiện chuyến đi<br/>(theo lịch trình được duyệt)"]
    Q --> R["Expense Claim<br/>Nhập chi phí & upload chứng từ"]

    R --> S["FINANCE<br/>Đối chiếu chi phí<br/>• So với dự toán<br/>• Kiểm tra chứng từ"]
    S --> T{"Hợp lệ?"}

    T -- "Không" --> U["Yêu cầu giải trình<br/>/ điều chỉnh"]
    U --> V["Kiểm tra lại"]
    V --> S

    T -- "Có" --> W["Thanh toán"]
    W --> X["Đóng hồ sơ<br/>(chuyến công tác)"]

    %% System data & audit
    X --> Y["SYSTEM<br/>Lưu trữ & ghi nhận dữ liệu<br/>• Lưu thông tin chuyến đi<br/>• Lưu Itinerary & lịch sử chỉnh sửa<br/>• Lưu lịch sử phê duyệt<br/>• Lưu Expense Claim & chứng từ<br/>• Lưu log hệ thống & audit trail"]

    %% Styling
    classDef employee fill:#eef5ff,stroke:#2563eb,stroke-width:1.5px,color:#0f172a;
    classDef system fill:#eefbf0,stroke:#16a34a,stroke-width:1.5px,color:#0f172a;
    classDef manager fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#0f172a;
    classDef admin fill:#f5f3ff,stroke:#7c3aed,stroke-width:1.5px,color:#0f172a;
    classDef finance fill:#fff7ed,stroke:#f97316,stroke-width:1.5px,color:#0f172a;
    classDef decision fill:#fffaf0,stroke:#f59e0b,stroke-width:1.5px,color:#0f172a;
    classDef end fill:#fff1f2,stroke:#ef4444,stroke-width:1.5px,color:#0f172a;

    class A,B,C,D,Q,R employee;
    class E,Y system;
    class J manager;
    class M,P admin;
    class S,U,V,W finance;
    class F,K,K2,N,T decision;
    class L,O,X end;
