import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";

function ServiceCategory({ title, services, isOpen, toggle, animated, onAdd }) {
  const animationClass = animated
    ? "opacity-0 translate-y-5 animate-slide-up-fade"
    : "opacity-0 -translate-x-[30px]";

  return (
    <div
      className={`mb-6 overflow-hidden rounded-xl border border-[#e0e0e0] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)] ${animationClass}`}
    >
      <button
        className="flex w-full items-center justify-center gap-2 bg-[#fdf3f8] px-5 py-4 text-center text-[1.1rem] font-semibold text-[#d63384] transition-colors hover:bg-[#fce8f0]"
        onClick={toggle}
      >
        <span>{title}</span>
        <span
          aria-hidden="true"
          className={
            isOpen
              ? "mt-1 h-0 w-0 border-l-[6px] border-r-[6px] border-b-[9px] border-l-transparent border-r-transparent border-b-[#d63384]"
              : "mt-1 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent border-t-[#d63384]"
          }
        />
      </button>
      {isOpen && (
        <ul className="list-none bg-white px-5 pb-5 pt-3">
          {services.map((service, index) => (
            <li key={index} className="mb-4 border-b border-[#f0f0f0] pb-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-[1rem] text-[#444]">{service.name}</h4>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[#d63384]">${service.price}</span>
                  <button
                    type="button"
                    className="rounded-full border border-[#d63384] px-3 py-1 text-[0.85rem] font-semibold text-[#d63384] transition-colors hover:bg-[#d63384] hover:text-white"
                    onClick={() => onAdd(title, service, index)}
                  >
                    Add
                  </button>
                </div>
              </div>
              <p className="mt-1 text-[0.9rem] text-[#777]">{service.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Services() {
  const SLOT_MINUTES = 15;

  const getServiceTimeValue = (categoryTitle, serviceName) => {
    if (categoryTitle === "Manicure") {
      const fourWeightServices = [
        "Deluxe Spa Paraffin Manicure",
        "Deluxe Manicure Spa Paraffin Manicure",
        "Lavender Manicure",
        "Lavendar Manicure",
        "Aloe Vera Manicure",
        "Coconut Manicure",
        "Hot Stone Manicure",
        "Kid's Mani & Pedi",
      ];
      if (serviceName === "Classic Manicure") return 2;
      if (serviceName === "Spa Manicure") return 3;
      if (fourWeightServices.includes(serviceName)) return 4;
      return 3;
    }
    if (categoryTitle === "Pedicure") {
      const fourWeightServices = [
        "Spa Pedicure with Gel Polish",
        "Hot Stone Pedicure",
        "Coconut Pedicure",
        "Aloe Vera Pedicure",
        "Lavender Pedicure",
        "Lavendar Pedicure",
        "Deluxe Spa Paraffin Pedicure",
        "Deluxe Pedicure Spa Paraffin Pedicure",
      ];
      if (serviceName === "Classic Pedicure") return 2;
      if (serviceName === "Spa Pedicure") return 3;
      if (fourWeightServices.includes(serviceName)) return 4;
      return 4;
    }
    if (categoryTitle === "Nail Enhancements") {
      const fourWeightServices = [
        "White Tip Full Set",
        "Solar Pink & White Full Set",
        "Acrylics Full Set",
        "Acylics Full Set",
        "Acrylic with Gel Polish",
        "Acylic with Gel Polish",
        "Dipping Powder Color",
        "Gel Shellac Pedi Color",
        "Gel Shellac Mani Color",
      ];
      const threeWeightServices = [
        "French Polish Change Nails",
        "French Polish Change Toes",
        "Shellac w/o Mani Color",
        "Shellac w/o Pedi Color",
        "Shallac w/o Mani Color",
        "Shallac w/o Pedi Color",
      ];
      const oneWeightServices = [
        "Kid Polish Change Nails",
        "Kid Polish Change Toes",
        "Nail Art Design",
        "Nail Repair (each)",
        "Soak Off",
        "Polish Change Nails",
        "Polish Change Toes",
        "Ingrown Nail Removal",
        "Machine Nail Filing",
        "Callus Removal Service",
        "Acrylic/Gel/Dipping Removal",
      ];
      if (fourWeightServices.includes(serviceName)) return 4;
      if (threeWeightServices.includes(serviceName)) return 3;
      if (oneWeightServices.includes(serviceName)) return 1;
      return 5;
    }
    if (categoryTitle === "Waxing") {
      const valueTwo = ["Back", "Chest", "Bikini", "Brazilian", "Brazillian"];
      if (valueTwo.includes(serviceName)) return 2;
      return 1;
    }
    if (categoryTitle === "Add-Ons") {
      return 1;
    }
    return 4;
  };

  const getServiceMaterialValues = (serviceName) => {
    const values = new Set();
    const normalized = serviceName.toLowerCase();

    if (
      normalized.includes("acrylic") ||
      normalized.includes("solar") ||
      normalized.includes("white tip")
    ) {
      values.add(1);
    }

    if (normalized.includes("gel") || normalized.includes("shellac")) {
      values.add(2);
    }

    if (
      normalized.includes("powder") ||
      normalized.includes("dipping") ||
      normalized.includes("dip ")
    ) {
      values.add(3);
    }

    if (values.size === 0) {
      values.add(0);
    }

    return Array.from(values).sort((a, b) => a - b);
  };

  const categories = [
    {
      title: "Manicure",
      services: [
        { name: "Classic Manicure", price: 25, description: "Manicure with massage" },
        { name: "Spa Manicure", price: 30, description: "Manicure with Massage and Exfoliation" },
        { name: "Deluxe Spa Paraffin Manicure", price: 40, description: "Moisturizes and softens the skin" },
        { name: "Lavender Manicure", price: 45, description: "Relaxes and soothes with lavender essence" },
        { name: "Aloe Vera Manicure", price: 47, description: "Soothes imperfections and hydrates skin" },
        { name: "Coconut Manicure", price: 50, description: "Helps improve skin disorders and hydrate" },
        { name: "Hot Stone Manicure", price: 52, description: "Eases muscle tension and improves circulation" },
        { name: "Kid's Mani & Pedi", price: 48, description: "For kids 5 and under" },
      ],
    },
    {
      title: "Pedicure",
      services: [
        { name: "Classic Pedicure", price: 35, description: "Pedicure with massage" },
        { name: "Spa Pedicure", price: 42, description: "Massage and exfoliation for relaxation" },
        { name: "Deluxe Spa Paraffin Pedicure", price: 52, description: "Moisturizes and softens skin" },
        { name: "Lavender Pedicure", price: 58, description: "Relieves anxiety and relaxes nerves" },
        { name: "Aloe Vera Pedicure", price: 62, description: "Soothes imperfections and hydrates skin" },
        { name: "Coconut Pedicure", price: 65, description: "Improves skin condition and moisturizes" },
        { name: "Hot Stone Pedicure", price: 68, description: "Boosts circulation and relieves muscle tension" },
        { name: "Spa Pedicure with Gel Polish", price: 69, description: "Long-lasting finish (French $75)" },
      ],
    },
    {
      title: "Nail Enhancements",
      services: [
        { name: "Gel Shellac Mani Color", price: 38, description: "French finish available ($45)" },
        { name: "Gel Shellac Pedi Color", price: 59, description: "French finish available ($67)" },
        { name: "Shellac w/o Mani Color", price: 32, description: "French finish available ($37)" },
        { name: "Shellac w/o Pedi Color", price: 37, description: "French finish available ($42)" },
        { name: "Dipping Powder Color", price: 48, description: "Natural finish (French $55)" },
        { name: "Acrylic with Gel Polish", price: 59, description: "Durable and glossy finish (French $66)" },
        { name: "Acrylics Full Set", price: 45, description: "Full acrylic application (Refill $35)" },
        { name: "Solar Pink & White Full Set", price: 58, description: "Two-tone pink and white (Refill $48)" },
        { name: "White Tip Full Set", price: 48, description: "Classic white tips (Refill $38)" },
        { name: "Polish Change Nails", price: 12, description: "Quick nail color refresh" },
        { name: "Polish Change Toes", price: 14, description: "Quick toe color refresh" },
        { name: "French Polish Change Nails", price: 19, description: "French polish finish for nails" },
        { name: "French Polish Change Toes", price: 22, description: "French polish finish for toes" },
        { name: "Soak Off", price: 12, description: "Safe product removal service" },
        { name: "Nail Repair (each)", price: 3, description: "Starts at $3 (up to $5 depending on repair)" },
        { name: "Nail Art Design", price: 4, description: "Starts at $4 and up" },
        { name: "Kid Polish Change Nails", price: 10, description: "Kid nail polish change" },
        { name: "Kid Polish Change Toes", price: 12, description: "Kid toe polish change" },
        { name: "Ingrown Nail Removal", price: 10, description: "Starts at $10 and up" },
        { name: "Machine Nail Filing", price: 10, description: "Starts at $10 and up" },
        { name: "Callus Removal Service", price: 22, description: "Focused callus removal treatment" },
        { name: "Acrylic/Gel/Dipping Removal", price: 18, description: "Removal service for acrylic, gel, or dipping" },
      ],
    },
    {
      title: "Add-Ons",
      services: [
        { name: "Nail Art (per nail)", price: 5, description: "Custom designs for individual nails" },
        { name: "French Tip Add-On", price: 10, description: "Classic French finish upgrade" },
        { name: "Paraffin Wax Treatment", price: 12, description: "Adds moisture and softens skin" },
        { name: "Hot Stone Massage (10 min)", price: 15, description: "Relaxing addition to any service" },
        { name: "Extra Massage (10 min)", price: 16, description: "Massage add-on" },
        { name: "Callus Removal", price: 10, description: "Smooths rough skin for softer feet" },
        { name: "Gel Polish Removal", price: 8, description: "Safe removal of gel polish" },
      ],
    },
    {
      title: "Waxing",
      services: [
        { name: "Nose", price: 10, description: "" },
        { name: "Lips", price: 10, description: "" },
        { name: "Chin", price: 14, description: "" },
        { name: "Eyebrow", price: 14, description: "" },
        { name: "Full Face", price: 45, description: "" },
        { name: "Dye Eyebrow", price: 22, description: "" },
        { name: "Dye Eyelash", price: 17, description: "" },
        { name: "Underarm", price: 22, description: "and up" },
        { name: "Back", price: 45, description: "and up" },
        { name: "Shoulder", price: 35, description: "and up" },
        { name: "Chest", price: 45, description: "and up" },
        { name: "Bikini", price: 35, description: "" },
        { name: "Arm Full", price: 25, description: "" },
        { name: "Arm Half", price: 35, description: "" },
        { name: "Legs Full", price: 60, description: "" },
        { name: "Legs Half", price: 35, description: "" },
        { name: "Brazilian", price: 68, description: "" },
      ],
    },
  ];

  const [openStates, setOpenStates] = useState(Array(categories.length).fill(false));
  const [animated, setAnimated] = useState(Array(categories.length).fill(false));
  const [activeDesktopCategory, setActiveDesktopCategory] = useState(categories[0].title);
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    categories.forEach((_, i) => {
      setTimeout(() => {
        setAnimated((prev) => {
          const updated = [...prev];
          updated[i] = true;
          return updated;
        });
      }, i * 200);
    });
  }, []);

  const toggleCategory = (index) => {
    const newStates = [...openStates];
    newStates[index] = !newStates[index];
    setOpenStates(newStates);
  };

  const collapseAll = () => setOpenStates(Array(categories.length).fill(false));
  const handleAddToCart = (categoryTitle, service, index) => {
    const timeValue = getServiceTimeValue(categoryTitle, service.name);
    const categoryValues = getServiceMaterialValues(service.name);
    setPendingItem({
      id: `${categoryTitle}-${service.name}-${index}`,
      name: service.name,
      price: service.price,
      category: categoryTitle,
      timeValue,
      categoryValues,
      durationMinutes: timeValue * SLOT_MINUTES,
    });
    setIsTechModalOpen(true);
  };

  const technicians = [
    { name: "Thy", blockedValues: [] },
    { name: "Jenny", blockedValues: [1, 3] },
    { name: "Tina", blockedValues: [1, 3] },
    { name: "Cindy", blockedValues: [1] },
    { name: "CK", blockedValues: [1] },
    { name: "Kim", blockedValues: [] },
  ];

  const availableTechnicians = pendingItem
    ? technicians.filter((tech) =>
        !(pendingItem.categoryValues || [0]).some((value) => tech.blockedValues.includes(value))
      )
    : technicians;

  const chooseTechnician = (technician) => {
    if (!pendingItem) return;
    addToCart({ ...pendingItem, technician: technician || undefined });
    setPendingItem(null);
    setIsTechModalOpen(false);
  };

  const closeTechModal = () => {
    setPendingItem(null);
    setIsTechModalOpen(false);
  };

  const selectedDesktopCategory =
    categories.find((category) => category.title === activeDesktopCategory) || categories[0];

  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-24 font-['Segoe_UI',_sans-serif] md:pt-28">
      <div className="mb-4 text-center">
        <h2 className="mb-2 text-center text-2xl font-bold text-[#333]">Our Services</h2>
        <div
          className="mb-8 flex flex-wrap items-center justify-center gap-4 animate-fade-in md:hidden"
          style={{ animationDelay: "300ms" }}
        >
          <button
            className="rounded-full bg-[#fcebef] px-5 py-2 text-[1rem] font-bold text-[#c7668b] hover:bg-[#fbd1dd]"
            onClick={collapseAll}
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="md:hidden">
        {categories.map((category, i) => (
          <ServiceCategory
            key={i}
            title={category.title}
            services={category.services}
            isOpen={openStates[i]}
            toggle={() => toggleCategory(i)}
            animated={animated[i]}
            onAdd={handleAddToCart}
          />
        ))}
      </div>

      <div className="hidden md:grid md:grid-cols-[220px_1fr] md:gap-6">
        <aside className="h-fit rounded-xl border border-[#ead2dc] bg-white/80 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#a35a79]">Categories</p>
          <div className="space-y-2">
            {categories.map((category) => (
              <button
                key={category.title}
                type="button"
                onClick={() => setActiveDesktopCategory(category.title)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  activeDesktopCategory === category.title
                    ? "border-[#c7668b] bg-[#c7668b] text-white"
                    : "border-[#e6d8df] bg-white text-[#5a5a5a] hover:border-[#c7668b] hover:text-[#c7668b]"
                }`}
              >
                {category.title}
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-xl border border-[#ead2dc] bg-white/85 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <h3 className="text-2xl font-bold text-[#c7668b]">{selectedDesktopCategory.title}</h3>
          <p className="mt-1 text-sm text-[#666]">Select a service to add it to your cart.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {selectedDesktopCategory.services.map((service, index) => (
              <div
                key={`${selectedDesktopCategory.title}-${service.name}-${index}`}
                className={`flex flex-col rounded-xl border border-[#efdce4] bg-white p-4 ${
                  selectedDesktopCategory.title === "Waxing" ? "min-h-[150px]" : "min-h-[210px]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-[1rem] font-semibold text-[#333]">{service.name}</h4>
                  <span className="font-bold text-[#c7668b]">${service.price}</span>
                </div>
                <p className="mt-2 text-sm text-[#777]">{service.description || " "}</p>
                <button
                  type="button"
                  className="mt-auto w-full rounded-lg border border-[#c7668b] px-3 py-2 text-sm font-semibold text-[#c7668b] transition-colors hover:bg-[#c7668b] hover:text-white"
                  onClick={() => handleAddToCart(selectedDesktopCategory.title, service, index)}
                >
                  Add Service
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isTechModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#333]">Choose a Technician</h3>
                {pendingItem && (
                  <p className="mt-1 text-sm text-[#777]">{pendingItem.name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeTechModal}
                className="rounded-full px-2 text-xl leading-none text-[#999] hover:text-[#333]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="col-span-2 rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 text-sm font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
                onClick={() => chooseTechnician("")}
              >
                Any Technician
              </button>
              {availableTechnicians.map((tech) => (
                <button
                  key={tech.name}
                  type="button"
                  className="rounded-xl border border-[#f0dbe2] bg-[#fdf3f8] px-4 py-3 text-sm font-semibold text-[#c7668b] transition-colors hover:bg-[#fce8f0]"
                  onClick={() => chooseTechnician(tech.name)}
                >
                  {tech.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Services;
