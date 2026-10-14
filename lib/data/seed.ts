import type { FinanceState, Scenario } from "@/types/finance";

export const demoState: FinanceState = {
  student: {
    name: "Hanru Li",
    school: "Virginia Tech",
    major: "Business Information Technology",
    year: "Senior"
  },
  semester: {
    name: "Fall 2026",
    startDate: "2026-08-24",
    endDate: "2026-12-16",
    currentDate: "2026-09-29"
  },
  cash: {
    checking: 6850,
    savings: 2500,
    targetEndingBuffer: 1000
  },
  incomes: [
    {
      id: "income-job",
      name: "Part-time campus job",
      amount: 650,
      startDate: "2026-09-01",
      endDate: "2026-11-30",
      recurring: true,
      frequency: "monthly",
      category: "Income",
      guaranteed: true
    },
    {
      id: "income-family",
      name: "Family support",
      amount: 500,
      startDate: "2026-10-01",
      recurring: false,
      category: "Income",
      guaranteed: true
    },
    {
      id: "income-scholarship",
      name: "Merit scholarship disbursement",
      amount: 1500,
      startDate: "2026-08-25",
      recurring: false,
      category: "Income",
      guaranteed: true
    }
  ],
  expenses: [
    {
      id: "expense-tuition",
      name: "Tuition installment",
      category: "Education",
      amount: 4200,
      startDate: "2026-09-15",
      recurring: false,
      required: true
    },
    {
      id: "expense-rent",
      name: "Rent",
      category: "Housing",
      amount: 750,
      startDate: "2026-09-01",
      endDate: "2026-12-01",
      recurring: true,
      frequency: "monthly",
      required: true
    },
    {
      id: "expense-utilities",
      name: "Utilities",
      category: "Housing",
      amount: 90,
      startDate: "2026-09-05",
      endDate: "2026-12-05",
      recurring: true,
      frequency: "monthly",
      required: true
    },
    {
      id: "expense-groceries",
      name: "Groceries allowance",
      category: "Groceries",
      amount: 300,
      startDate: "2026-10-01",
      endDate: "2026-12-01",
      recurring: true,
      frequency: "monthly",
      required: true
    },
    {
      id: "expense-transportation",
      name: "Transportation",
      category: "Transportation",
      amount: 100,
      startDate: "2026-10-01",
      endDate: "2026-12-01",
      recurring: true,
      frequency: "monthly",
      required: true
    },
    {
      id: "expense-phone",
      name: "Phone bill",
      category: "Subscriptions",
      amount: 55,
      startDate: "2026-10-12",
      endDate: "2026-12-12",
      recurring: true,
      frequency: "monthly",
      required: true
    },
    {
      id: "expense-subscriptions",
      name: "Subscriptions",
      category: "Subscriptions",
      amount: 35,
      startDate: "2026-10-05",
      endDate: "2026-12-05",
      recurring: true,
      frequency: "monthly",
      required: false
    },
    {
      id: "expense-textbooks",
      name: "Textbooks and lab materials",
      category: "Education",
      amount: 350,
      startDate: "2026-08-27",
      recurring: false,
      required: true
    },
    {
      id: "expense-weekend",
      name: "Dining and weekend plans",
      category: "Dining",
      amount: 95,
      startDate: "2026-10-02",
      endDate: "2026-12-11",
      recurring: true,
      frequency: "weekly",
      required: false
    }
  ],
  transactions: [
    { id: "t1", merchant: "Kroger", date: "2026-09-02", amount: 72.34, category: "Groceries" },
    { id: "t2", merchant: "Chipotle", date: "2026-09-03", amount: 13.88, category: "Dining" },
    { id: "t3", merchant: "Shell", date: "2026-09-04", amount: 41.2, category: "Transportation" },
    { id: "t4", merchant: "Netflix", date: "2026-09-05", amount: 15.49, category: "Subscriptions" },
    { id: "t5", merchant: "University Bookstore", date: "2026-09-06", amount: 86.15, category: "Education" },
    { id: "t6", merchant: "Starbucks", date: "2026-09-07", amount: 6.45, category: "Dining" },
    { id: "t7", merchant: "Target", date: "2026-09-08", amount: 54.96, category: "Shopping" },
    { id: "t8", merchant: "Blacksburg Transit", date: "2026-09-09", amount: 12, category: "Transportation" },
    { id: "t9", merchant: "Cinemark", date: "2026-09-12", amount: 18.5, category: "Entertainment" },
    { id: "t10", merchant: "Kroger", date: "2026-09-14", amount: 64.23, category: "Groceries" },
    { id: "t11", merchant: "Panera Bread", date: "2026-09-15", amount: 15.1, category: "Dining" },
    { id: "t12", merchant: "Amazon", date: "2026-09-18", amount: 39.99, category: "Shopping" },
    { id: "t13", merchant: "Spotify", date: "2026-09-19", amount: 5.99, category: "Subscriptions" },
    { id: "t14", merchant: "Cook Out", date: "2026-09-21", amount: 11.37, category: "Dining" },
    { id: "t15", merchant: "Food Lion", date: "2026-09-23", amount: 58.44, category: "Groceries" },
    { id: "t16", merchant: "Student Activity Center", date: "2026-09-25", amount: 22, category: "Entertainment" },
    { id: "t17", merchant: "CVS", date: "2026-09-26", amount: 19.82, category: "Other" },
    { id: "t18", merchant: "Mellow Mushroom", date: "2026-09-27", amount: 24.31, category: "Dining" }
  ],
  goals: [
    {
      id: "goal-buffer",
      name: "Keep a semester-end cushion",
      targetAmount: 1000,
      description: "Keep at least $1,000 available when finals end."
    }
  ]
};

export const presetScenarios: Scenario[] = [
  {
    id: "trip",
    name: "Chicago Trip",
    description: "What if I spend $500 on a trip in November?",
    type: "purchase",
    amount: 500,
    date: "2026-11-12"
  },
  {
    id: "stop-working",
    name: "Stop Working",
    description: "What if I stop working after October 1?",
    type: "income-loss",
    incomeName: "Part-time campus job",
    stopDate: "2026-10-01"
  },
  {
    id: "rent-increase",
    name: "Rent Increase",
    description: "What if rent increases by $100/month?",
    type: "expense-change",
    expenseName: "Rent",
    amount: 100,
    date: "2026-10-01"
  },
  {
    id: "invest",
    name: "Invest $300",
    description: "What if I move $300 into a beginner investment account?",
    type: "investment",
    amount: 300,
    date: "2026-10-15"
  },
  {
    id: "car-repair",
    name: "Car Repair",
    description: "What if I have an unexpected $700 car repair?",
    type: "unexpected-expense",
    amount: 700,
    date: "2026-10-20"
  }
];
