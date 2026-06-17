const DEFAULT_ORG_STRUCTURE = [
  {
    name: 'Administration',
    code: 'ADMIN',
    designations: ['Administrator', 'Office Administrator', 'Executive Assistant', 'Receptionist'],
  },
  {
    name: 'Engineering',
    code: 'ENG',
    designations: [
      'CTO',
      'Engineering Manager',
      'Principal Engineer',
      'Senior Software Engineer',
      'Software Engineer',
      'Junior Software Engineer',
      'Full Stack Developer',
      'Frontend Developer',
      'Backend Developer',
      'Mobile App Developer',
      'DevOps Engineer',
      'System Administrator',
      'Cloud Engineer',
      'Intern',
      'Trainee',
    ],
  },
  {
    name: 'Design',
    code: 'DESIGN',
    designations: ['Design Lead', 'UI/UX Designer', 'Senior Designer', 'Graphic Designer', 'Motion Designer'],
  },
  {
    name: 'Digital Marketing',
    code: 'DM',
    designations: [
      'Digital Marketing Manager',
      'Digital Marketing Executive',
      'Performance Marketing Manager',
      'PPC Specialist',
      'Email Marketing Specialist',
      'Social Media Manager',
      'Social Media Executive',
    ],
  },
  {
    name: 'Content & Media',
    code: 'CONTENT',
    designations: ['Content Strategist', 'Senior Content Writer', 'Content Writer', 'Copywriter', 'Video Editor'],
  },
  {
    name: 'SEO',
    code: 'SEO',
    designations: ['SEO Manager', 'SEO Specialist', 'SEO Analyst'],
  },
  {
    name: 'Sales',
    code: 'SALES',
    designations: ['Sales Manager', 'Sales Executive', 'Business Development Manager', 'Business Development Executive', 'Account Manager'],
  },
  {
    name: 'Human Resources',
    code: 'HR',
    designations: ['HR Manager', 'HR Executive', 'Recruiter', 'Training Coordinator'],
  },
  {
    name: 'Finance',
    code: 'FIN',
    designations: ['CFO', 'Finance Manager', 'Accountant', 'Accounts Officer', 'Billing Officer'],
  },
  {
    name: 'Operations',
    code: 'OPS',
    designations: ['COO', 'Operations Manager', 'Operations Executive', 'Office Coordinator'],
  },
  {
    name: 'Quality Assurance',
    code: 'QA',
    designations: ['QA Lead', 'Senior QA Engineer', 'QA Engineer', 'QA Analyst'],
  },
  {
    name: 'Product',
    code: 'PRODUCT',
    designations: ['Product Manager', 'Project Manager', 'Scrum Master', 'Business Analyst'],
  },
  {
    name: 'Data & Analytics',
    code: 'DATA',
    designations: ['Data Analyst', 'Data Scientist', 'Data Engineer'],
  },
  {
    name: 'Customer Support',
    code: 'SUPPORT',
    designations: ['Customer Support Manager', 'Customer Support Executive', 'Support Engineer'],
  },
  {
    name: 'Management',
    code: 'MGMT',
    designations: ['CEO', 'Director', 'Vice President', 'Senior Manager', 'Manager', 'Assistant Manager', 'Team Lead'],
  },
];

async function seedDefaultOrgStructure(tx, orgId) {
  for (let deptIndex = 0; deptIndex < DEFAULT_ORG_STRUCTURE.length; deptIndex += 1) {
    const item = DEFAULT_ORG_STRUCTURE[deptIndex];
    const department = await tx.department.upsert({
      where: { orgId_name: { orgId, name: item.name } },
      create: {
        orgId,
        name: item.name,
        code: item.code,
        sortOrder: deptIndex,
      },
      update: {
        code: item.code,
        sortOrder: deptIndex,
        isActive: true,
      },
    });

    for (let desigIndex = 0; desigIndex < item.designations.length; desigIndex += 1) {
      const name = item.designations[desigIndex];
      await tx.designation.upsert({
        where: {
          orgId_departmentId_name: {
            orgId,
            departmentId: department.id,
            name,
          },
        },
        create: {
          orgId,
          departmentId: department.id,
          name,
          level: desigIndex,
          sortOrder: desigIndex,
        },
        update: {
          level: desigIndex,
          sortOrder: desigIndex,
          isActive: true,
        },
      });
    }
  }
}

module.exports = {
  DEFAULT_ORG_STRUCTURE,
  seedDefaultOrgStructure,
};
