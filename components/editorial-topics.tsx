export function EditorialTopics({
  items,
}: {
  items: { title: string; text: string }[];
}) {
  return (
    <div className="editorial-topics">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`}>
          <span className="topic-number mono" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}
