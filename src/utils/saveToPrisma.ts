import { prisma } from "@/lib/prisma";
import { ExtendedNode } from "./analyzeWithAI";

export const saveToPrisma = async (
  title: string,
  filePath: string,
  nodes: ExtendedNode[]
): Promise<any> => {
  console.log("Nodes akan disimpan ke Prisma:");
  console.log(JSON.stringify(nodes, null, 2));

  const cleanNodes = nodes.map(({id, ...node}) => ({
      label: node.label,
      title: node.label,
      type: node.type,
      content: node.content!,
      att_goal: node.att_goal,
      att_method: node.att_method,
      att_background: node.att_background,
      att_future: node.att_future,
      att_gaps: node.att_gaps,
      att_url: node.att_url,
  }));

  const article = await prisma.article.create({
    data: {
      title,
      filePath,
      createdAt: new Date(),
      nodes: {
        create: cleanNodes, 
    },
    },
    include: {
      nodes: true,
    },
  });

  return article;
};
