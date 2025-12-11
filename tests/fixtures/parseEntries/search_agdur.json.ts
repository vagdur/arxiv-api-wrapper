import { ArxivEntry } from '../../../src/types';

export const expectedEntries: ArxivEntry[] = [
  {
    id: "http://arxiv.org/abs/1906.03709v1",
    arxivId: "1906.03709v1",
    title: "Finitary Boolean functions",
    summary: "We study functions on the infinite-dimensional Hamming cube $\\{-1,1\\}^\\infty$, in particular Boolean functions into $\\{-1,1\\}$, generalising results on analysis of Boolean functions on $\\{-1,1\\}^n$ for $n\\in\\mathbb{N}$. The notion of noise sensitivity, first studied in arXiv:math/9811157 , is extended to this setting, and basic Fourier formulas are established. We also prove hypercontractivity estimates for these functions, and give a version of the Kahn-Kalai-Linial theorem giving a bound relating the total influence to the maximal influence. Particular attention is paid to so-called finitary functions, which are functions for which there exists an algorithm that almost surely queries only finitely many bits. Two versions of the Benjamini-Kalai-Schramm theorem characterizing noise sensitivity in terms of the sum of squared influences are given, under additional moment hypotheses on the amount of bits looked at by an algorithm. A version of the Kahn-Kalai-Linial theorem giving that the maximal influence is of order $\\frac{\\log(n)}{n}$ is also given, replacing $n$ with the expected number of bits looked at by an algorithm. Finally, we show that the result in arXiv:math/0504586 that revealments going to zero implies noise sensitivity also holds for finitary functions, and apply this to show noise sensitivity of a version of the voter model on sufficiently sparse graphs.",
    published: "2019-06-09T21:10:09Z",
    updated: "2019-06-09T21:10:09Z",
    authors: [
      {
        name: "Vilhelm Agdur"
      }
    ],
    categories: [
      "math.PR"
    ],
    primaryCategory: "math.PR",
    links: [
      {
        href: "http://arxiv.org/abs/1906.03709v1",
        rel: "alternate",
        type: "text/html"
      },
      {
        href: "http://arxiv.org/pdf/1906.03709v1",
        rel: "related",
        type: "application/pdf",
        title: "pdf"
      }
    ],
    comment: "33 pages, 2 figures. Originally as Master's Thesis at Gothenburg University"
  },
  {
    id: "http://arxiv.org/abs/2404.03332v2",
    arxivId: "2404.03332v2",
    title: "A classification of overlapping clustering schemes for hypergraphs",
    summary: "Community detection in graphs is a problem that is likely to be relevant whenever network data appears, and consequently the problem has received much attention with many different methods and algorithms applied. However, many of these methods are hard to study theoretically, and they optimise for somewhat different goals. A general and rigorous account of the problem and possible methods remains elusive. We study the problem of finding overlapping clusterings of hypergraphs, continuing the line of research started by Carlsson and M\\'emoli (2013) of classifying clustering schemes as functors. We extend their notion of representability to the overlapping case, showing that any representable overlapping clustering scheme is excisive and functorial, and any excisive and functorial clustering scheme is isomorphic to a representable clustering scheme. We also note that, for simple graphs, any representable clustering scheme is computable in polynomial time on graphs of bounded expansion, with an exponent determined by the maximum independence number of a graph in the representing set. This result also applies to non-overlapping representable clustering schemes, and so may be of independent interest.",
    published: "2024-04-04T10:00:35Z",
    updated: "2025-05-15T15:07:53Z",
    authors: [
      {
        name: "Vilhelm Agdur"
      }
    ],
    categories: [
      "math.CO",
      "cs.SI",
      "math.CT"
    ],
    primaryCategory: "math.CO",
    links: [
      {
        href: "http://arxiv.org/abs/2404.03332v2",
        rel: "alternate",
        type: "text/html"
      },
      {
        href: "http://arxiv.org/pdf/2404.03332v2",
        rel: "related",
        type: "application/pdf",
        title: "pdf"
      }
    ],
    comment: "31 pages, 11 figures"
  },
  {
    id: "http://arxiv.org/abs/2307.07271v1",
    arxivId: "2307.07271v1",
    title: "Universal lower bound for community structure of sparse graphs",
    summary: "We prove new lower bounds on the modularity of graphs. Specifically, the modularity of a graph $G$ with average degree $\\bar d$ is $\\Omega(\\bar{d}^{-1/2})$, under some mild assumptions on the degree sequence of $G$. The lower bound $\\Omega(\\bar{d}^{-1/2})$ applies, for instance, to graphs with a power-law degree sequence or a near-regular degree sequence. It has been suggested that the relatively high modularity of the Erd\\H{o}s-R\\'enyi random graph $G_{n,p}$ stems from the random fluctuations in its edge distribution, however our results imply high modularity for any graph with a degree sequence matching that typically found in $G_{n,p}$. The proof of the new lower bound relies on certain weight-balanced bisections with few cross-edges, which build on ideas of Alon [Combinatorics, Probability and Computing (1997)] and may be of independent interest.",
    published: "2023-07-14T10:53:12Z",
    updated: "2023-07-14T10:53:12Z",
    authors: [
      {
        name: "Vilhelm Agdur"
      },
      {
        name: "Nina Kamčev"
      },
      {
        name: "Fiona Skerman"
      }
    ],
    categories: [
      "math.CO",
      "cs.DS",
      "cs.SI",
      "math.PR"
    ],
    primaryCategory: "math.CO",
    links: [
      {
        href: "http://arxiv.org/abs/2307.07271v1",
        rel: "alternate",
        type: "text/html"
      },
      {
        href: "http://arxiv.org/pdf/2307.07271v1",
        rel: "related",
        type: "application/pdf",
        title: "pdf"
      }
    ],
    comment: "25 pages, 2 figures"
  },
  {
    id: "http://arxiv.org/abs/2507.17541v1",
    arxivId: "2507.17541v1",
    title: "Approximating temporal modularity on graphs of small underlying treewidth",
    summary: "Modularity is a very widely used measure of the level of clustering or community structure in networks. Here we consider a recent generalisation of the definition of modularity to temporal graphs, whose edge-sets change over discrete timesteps; such graphs offer a more realistic model of many real-world networks in which connections between entities (for example, between individuals in a social network) evolve over time. Computing modularity is notoriously difficult: it is NP-hard even to approximate in general, and only admits efficient exact algorithms in very restricted special cases. Our main result is that a multiplicative approximation to temporal modularity can be computed efficiently when the underlying graph has small treewidth. This generalises a similar approximation algorithm for the static case, but requires some substantially new ideas to overcome technical challenges associated with the temporal nature of the problem.",
    published: "2025-07-23T14:19:44Z",
    updated: "2025-07-23T14:19:44Z",
    authors: [
      {
        name: "Vilhelm Agdur"
      },
      {
        name: "Jessica Enright"
      },
      {
        name: "Laura Larios-Jones"
      },
      {
        name: "Kitty Meeks"
      },
      {
        name: "Fiona Skerman"
      },
      {
        name: "Ella Yates"
      }
    ],
    categories: [
      "math.CO",
      "cs.DM"
    ],
    primaryCategory: "math.CO",
    links: [
      {
        href: "http://arxiv.org/abs/2507.17541v1",
        rel: "alternate",
        type: "text/html"
      },
      {
        href: "http://arxiv.org/pdf/2507.17541v1",
        rel: "related",
        type: "application/pdf",
        title: "pdf"
      }
    ]
  }
];

